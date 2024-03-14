import express from 'express';
import { getUserInfo, logOutUser, loginUser, registerUser, socialAuth, updateAccessToken, updateUserAvatar, updateUserInfo, updateUserPassword } from '../controllers/user.controller';
import { activateUser } from '../utils/activateUser';
import { isAuthenticated } from '../middlewares/auth';

const userRouter = express.Router();

userRouter.post("/registerUser", registerUser);
userRouter.post("/activateUser", activateUser);
userRouter.post("/loginUser", loginUser);
userRouter.get("/logoutUser", isAuthenticated, logOutUser);
userRouter.get("/refreshToken", updateAccessToken);
userRouter.get("/me", isAuthenticated, getUserInfo);
userRouter.post("/socialAuth", socialAuth);
userRouter.put("/updateUserInfo", isAuthenticated, updateUserInfo);
userRouter.put("/updateUserPassword", isAuthenticated, updateUserPassword);
userRouter.put("/updateUserAvatar", isAuthenticated, updateUserAvatar);

export default userRouter;