import { NextFunction, Request, Response } from "express"
import { CatchAsyncError } from "../middlewares/catchAsyncErrors"
import ErrorHandler from "./ErrorHandler"
import userModel, { IUser } from "../models/user.model"
import jwt from 'jsonwebtoken';


interface IActivationRequest {
    activation_token: string
    activation_code: string
}

export const activateUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activation_token, activation_code } = req.body as IActivationRequest;
        const newUser: { user: IUser; activationCode: string } = jwt.verify(
            activation_token,
            process.env.ACTIVATION_SECRET as string
        ) as { user: IUser; activationCode: string };

        if (newUser.activationCode !== activation_code) return next(new ErrorHandler("Invalid activation code", 400));

        const { name, email, password } = newUser.user;

        const existUser = await userModel.findOne({ email });

        if (existUser) return next(new ErrorHandler("Email already exist", 400));

        await userModel.create({
            name,
            email,
            password
        });

        res.status(201).json({
            success: true,
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
    }
})