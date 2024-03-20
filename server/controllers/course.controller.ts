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
import { createCourse } from '../services/course.service';
import CourseModel from '../models/course.model';


// upload course
export const uploadCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const data = req.body;
        const thumbNail = data.thumbNail;

        if (thumbNail) {
            const myCloud = await cloudinary.v2.uploader.upload(thumbNail, {
                folder: "courses"
            });

            data.thumbNail = {
                public_id: myCloud.public_id,
                url: myCloud.url
            }
        }

        await createCourse(data, res, next);


    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
});

// edit course
export const editCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {

    // todo: write this controller more professional way
    try {

        const data = req.body;
        const thumbNail = data.thumbNail;

        if (thumbNail) {
            await cloudinary.v2.uploader.destroy(thumbNail.public_id);

            const myCloud = await cloudinary.v2.uploader.upload(thumbNail, {
                folder: "courses"
            });

            data.thumbNail = {
                public_id: myCloud.public_id,
                url: myCloud.url
            }
        }

        const courseId = req.params.id;
        const course = await CourseModel.findByIdAndUpdate(courseId, data, {
            $set: data,
            new: true
        })

        res.status(201).json({
            success: true,
            course
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
});