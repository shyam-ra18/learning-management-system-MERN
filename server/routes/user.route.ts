import express from 'express';
import { registerUser } from '../controllers/user.controller';
import { activateUser } from '../utils/activateUser';

const userRouter = express.Router();

userRouter.post("/registerUser", registerUser);
userRouter.post("/activateUser", activateUser);

export default userRouter;