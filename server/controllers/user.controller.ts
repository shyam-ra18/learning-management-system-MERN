import { Request, Response, NextFunction } from 'express';
import userModel, { IUser } from '../models/user.model';
import ErrorHandler from '../utils/ErrorHandler';
import { CatchAsyncError } from '../middlewares/catchAsyncErrors';
import { createActivationToken } from '../utils/tokens';
import path from 'path';
import sendMail from '../utils/sendMail';
import { sendToken } from '../utils/jwt';


interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

interface ILoginBody {
  email: string;
  password: string;
}

// register user

export const registerUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    const isEmailExist = await userModel.findOne({ email });
    if (isEmailExist) return next(new ErrorHandler("Email already exists", 400));

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
    const accessToken = req.cookies.access_token;
    const refreshToken = req.cookies.refresh_token;

    // Blacklist tokens
    // redis.sadd('blacklist:access_tokens', accessToken);
    // redis.sadd('blacklist:refresh_tokens', refreshToken);

    // Clear cookies
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    res.status(200).json({
      success: true,
      message: "User logged out successfully"
    });

  } catch (error: any) {
    return next(new ErrorHandler(error.message, 400));
  }
});