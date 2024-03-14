import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { CatchAsyncError } from '../middlewares/catchAsyncErrors';
import userModel from '../models/user.model';
import { getUserById } from '../services/user.service';
import ErrorHandler from '../utils/ErrorHandler';
import { accessTokenOptions, refreshTokenOptions, sendToken } from '../utils/jwt';
import { redis } from '../utils/redis';
import sendMail from '../utils/sendMail';
import { createActivationToken } from '../utils/tokens';
import cloudinary from "cloudinary";


interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}
interface ISocialAuthBody {
  name: string;
  email: string;
  avatar?: string;
}

interface ILoginBody {
  email: string;
  password: string;
}

interface IUpdateUserInfo {
  name?: string;
  email?: string;
}

interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

interface IUpdateAvatar {
  avatar: string;
}

// register user

export const registerUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    const isEmailExist = await userModel.findOne({ email });
    if (isEmailExist) return next(new ErrorHandler("Email already exists", 400));

    if (!password) return next(new ErrorHandler("Please enter your password", 400));
    if (!email) return next(new ErrorHandler("Please enter your email", 400));

    const user: IRegistrationBody = {
      name,
      email,
      password,
    };

    const activationToken = createActivationToken(user);
    const activationCode = activationToken.activationCode;
    const data = { user: { name: user.name }, activationCode };
    // const html = await ejs.renderFile(path.join(__dirname, "../mails/activation-mail.ejs"), data);

    try {
      await sendMail({
        email: user.email,
        subject: "Activate your account",
        template: "activation-mail.ejs",
        data
      });

      res.status(201).json({
        success: true,
        message: "Please check your email to activate your account!",
        activationToken: activationToken.token
      })
    } catch (error: any) {
      return new ErrorHandler(error.message, 400)
    }

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// login user

export const loginUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    const { email, password } = req.body as ILoginBody;
    if (!email || !password) return next(new ErrorHandler("Please enter email and password", 400));

    const user = await userModel.findOne({ email }).select("+password");
    if (!user) return next(new ErrorHandler("Invalid email and password", 400));

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) return next(new ErrorHandler("Invalid email and password", 400));

    sendToken(user, 200, res);

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
})

// logout user

export const logOutUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Clear cookies
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    const userId = req?.user?._id || "";
    redis.del(userId);

    res.status(200).json({
      success: true,
      message: "User logged out successfully"
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// update access token
export const updateAccessToken = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    const refresh_token = req.cookies.refresh_token as string;
    const decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET! as string) as JwtPayload;
    if (!decoded) return next(new ErrorHandler('could not get refresh token', 400));

    const session = await redis.get(decoded.id as string);
    if (!session) return next(new ErrorHandler('could not get refresh token', 400));

    const user = JSON.parse(session);

    const accessToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN_SECRET! as string, {
      expiresIn: "10m"
    });
    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET! as string, {
      expiresIn: "7d"
    });

    req.user = user;

    res.cookie("access_token", accessToken, accessTokenOptions);
    res.cookie("refresh_token", refreshToken, refreshTokenOptions);

    res.status(200).json({
      success: true,
      user,
      accessToken
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// get user info
export const getUserInfo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    const userId = req.user?._id;
    getUserById(userId, res, next);

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// social auth
export const socialAuth = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    const { email, name, avatar } = req.body as ISocialAuthBody;
    const user = await userModel.findOne({ email });
    if (!user) {
      const newUser = await userModel.create({ email, name, avatar });
      sendToken(newUser, 200, res);
    }
    else {
      sendToken(user, 200, res);
    }

    //todo: send mail for social auth

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// update user info
export const updateUserInfo = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    const { name, email } = req.body as IUpdateUserInfo;
    const userId = req.user?._id;
    const user = await userModel.findById(userId);

    if (email && user) {
      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) return next(new ErrorHandler("Email already exist", 400));
      user.email = email;
    }

    if (name && user) {
      user.name = name;
    }

    await user?.save();
    await redis.set(userId, JSON.stringify(user));

    res.status(201).json({
      success: true,
      user,
    })


  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// update user password
export const updateUserPassword = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    const { oldPassword, newPassword } = req.body as IUpdatePassword;
    const user = await userModel.findById(req.user?._id).select("+password");

    if (!oldPassword || !newPassword) return next(new ErrorHandler("Please enter password field", 400));
    if (!user || !user.password) return next(new ErrorHandler("User not found or invalid user", 400));

    const isPasswordMatch = await user?.comparePassword(oldPassword);
    if (!isPasswordMatch) return next(new ErrorHandler("Invalid old password", 400));

    const isNewPasswordSameAsOld = await user?.comparePassword(newPassword);
    if (isNewPasswordSameAsOld) return next(new ErrorHandler("New password cannot be the same as the old password", 400));


    user.password = newPassword;

    await user?.save();
    await redis.set(req.user?._id, JSON.stringify(user));

    res.status(201).json({
      success: true,
      user,
    })


  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// update user avatar
export const updateUserAvatar = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {

    const { avatar } = req.body as IUpdateAvatar;
    const user = await userModel.findById(req.user?._id);

    if (!avatar) return next(new ErrorHandler("Avatar not found", 400));

    if (avatar && user) {
      if (user?.avatar?.public_id) {

        //remove old image
        await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);

        //add new image
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
          folder: "avatars",
          width: 150,
        });

        user.avatar = {
          public_id: myCloud.public_id,
          url: myCloud.url
        }
      }
      else {
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
          folder: "avatars",
          width: 150,
        });

        user.avatar = {
          public_id: myCloud.public_id,
          url: myCloud.url
        }
      }
    }

    await user?.save();
    await redis.set(req.user?._id, JSON.stringify(user));

    res.status(200).json({
      success: true,
      user,
    })

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});