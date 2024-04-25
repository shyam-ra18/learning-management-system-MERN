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
import mongoose from 'mongoose';
import ejs from 'ejs';
import path from 'path';

interface IAddQuestionData {
    question: string;
    courseId: string;
    contentId: string;
}

interface IAddAnswerionData {
    answer: string;
    courseId: string;
    contentId: string;
    questionId: string;
}


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

// get single course --- without purchasing
export const getSingleCourse = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const courseId = req.params.id;
        const isCacheExist = await redis.get(courseId);

        if (isCacheExist) {
            const course = JSON.parse(isCacheExist);
            res.status(200).json({
                success: true,
                course
            });
        }
        else {
            const course = await CourseModel.findById(courseId).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");

            await redis.set(courseId, JSON.stringify(course));

            res.status(200).json({
                success: true,
                course
            });
        }

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
});

// get all course --- without purchasing
export const getAllCourses = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const isCacheExist = await redis.get("allCourses");
        if (isCacheExist) {

            const courses = JSON.parse(isCacheExist);
            res.status(200).json({
                success: true,
                courses
            });

        }
        else {
            const courses = await CourseModel.find().select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");

            await redis.set("allCourses", JSON.stringify(courses));

            res.status(200).json({
                success: true,
                courses
            });
        }

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
});

// get course content  ---only for valid user
export const getCourseByUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const userCourseList = req.user?.courses;
        const courseId = req.params.id;

        const courseExist = userCourseList?.find((course: any) => course._id.toString() === courseId.toString());
        const isCacheExist = await redis.get(courseId);

        if (!courseExist) {
            return next(new ErrorHandler("You are not eligible to access this course", 400));
        }

        const course = await CourseModel.findById(courseId);
        const content = course?.courseData;

        res.status(200).json({
            success: true,
            content
        })


    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
});

// add question in course
export const addQuestion = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const { question, courseId, contentId }: IAddQuestionData = req.body;
        const course = await CourseModel.findById(courseId);

        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler("Invalid content id", 400));
        }

        const courseContent = course?.courseData?.find((item: any) => item._id.equals(contentId));

        if (!courseContent) {
            return next(new ErrorHandler("Invalid content id", 400));
        }

        // create a new question object
        const newQuestion: any = {
            user: req.user,
            question,
            questionReplies: []
        };

        // add this question to our course content
        courseContent.questions.push(newQuestion)

        //save the updated course
        await course?.save();

        res.status(200).json({
            success: true,
            course
        })


    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
});

//add answer in course question
export const addAnswer = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {

        const { answer, courseId, contentId, questionId }: IAddAnswerionData = req.body;
        const course = await CourseModel.findById(courseId);

        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler("Invalid content id", 400));
        }

        const courseContent = course?.courseData?.find((item: any) => item._id.equals(contentId));

        if (!courseContent) {
            return next(new ErrorHandler("Invalid content id", 400));
        }

        const question = courseContent?.questions?.find((item: any) => item._id.equals(questionId));

        if (!question) {
            return next(new ErrorHandler("Invalid question id", 400));
        }

        // create a new answer object
        const newAnswer: any = {
            user: req.user,
            answer
        };

        // add this answer to our course content
        question?.questionReplies?.push(newAnswer);

        //save the updated course
        await course?.save();

        if (req.user?._id === question.user?._id) {
            //create a notifiaction
        }
        else {
            const data = {
                name: question.user.name,
                title: courseContent.title
            }
            // const html = await ejs.renderFile(path.join(__dirname, "../mails/activation-mail.ejs"), data);

            try {
                await sendMail({
                    email: question.user.email,
                    subject: "Question Reply",
                    template: "question-reply.ejs",
                    data
                });

            } catch (error: any) {
                return new ErrorHandler(error.message, 400)
            }
        }

        res.status(200).json({
            success: true,
            course
        })

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
});
