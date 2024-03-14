import { NextFunction, Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { redis } from "../utils/redis";

// get user by id
export const getUserById = async (id: string, res: Response, next: NextFunction) => {
    const userJson = await redis.get(id);
    if (userJson) {
        const user = JSON.parse(userJson);
        if (!user) return next(new ErrorHandler("User not found", 400));

        res.status(200).json({
            success: true,
            user,
        })
    }
};