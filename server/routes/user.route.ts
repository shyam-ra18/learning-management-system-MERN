import express from 'express';
import { logOutUser, loginUser, registerUser } from '../controllers/user.controller';
import { activateUser } from '../utils/activateUser';
import { isAuthenticated } from '../middlewares/auth';

const userRouter = express.Router();

userRouter.post("/registerUser", registerUser);
userRouter.post("/activateUser", activateUser);
userRouter.post("/loginUser", loginUser);
userRouter.get("/logoutUser", isAuthenticated, logOutUser);

export default userRouter;