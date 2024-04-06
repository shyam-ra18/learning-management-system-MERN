import express from 'express';
import { authorizeRole, isAuthenticated } from '../middlewares/auth';
import { editCourse, getAllCourses, getCourseByUser, getSingleCourse, uploadCourse } from '../controllers/course.controller';

const courseRouter = express.Router();

courseRouter.post("/createCourse", isAuthenticated, authorizeRole("admin"), uploadCourse);
courseRouter.put("/editCourse/:id", isAuthenticated, authorizeRole("admin"), editCourse);
courseRouter.get("/getSingleCourse/:id", getSingleCourse);
courseRouter.get("/getAllCourses", getAllCourses);
courseRouter.get("/getCourseByUser/:id", isAuthenticated, getCourseByUser);

export default courseRouter;