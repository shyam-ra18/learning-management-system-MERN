import { Request, Response, NextFunction } from 'express';
import ejs from "ejs";
import userModel, { IUser } from '../models/user.model';
import ErrorHandler from '../utils/ErrorHandler';
import { CatchAsyncError } from '../middlewares/catchAsyncErrors';
import { createActivationToken } from '../utils/tokens';
import path from 'path';
import sendMail from '../utils/sendMail';

// register user

interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

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