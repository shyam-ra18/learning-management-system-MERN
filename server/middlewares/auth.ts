import "dotenv/config";
import { Request, Response, NextFunction } from 'express';
import { CatchAsyncError } from './catchAsyncErrors';
import ErrorHandler from '../utils/ErrorHandler';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { redis } from "../utils/redis";

//authenticated user 
export const isAuthenticated = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {

    const access_token = req?.cookies?.access_token;
    if (!access_token) return next(new ErrorHandler("Unauthorized Access", 401));

    const decodec = jwt.verify(access_token, process.env.ACCESS_TOKEN_SECRET as string) as JwtPayload;
    if (!decodec) return next(new ErrorHandler("Invalid token", 400));

    const user = await redis.get(decodec.id);
    if (!user) return next(new ErrorHandler("User not found", 400));

    req.user = JSON.parse(user);
    next();
});

//validate user role
export const authorizeRole = (...role: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!role.includes(req.user?.role || '')) {
            return next(new ErrorHandler(`Role: ${req.user?.role} is not allowed to access this resource`, 403));
        }
    }
} 
