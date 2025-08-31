import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { emailVerificationMailgenContent, forgotPasswordMailgenContent, sendEmail } from "../utils/mail.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
      try {
            const user = await User.findById(userId);
            const accessToken = user.generateAccessToken();
            const refreshToken = user.generateRefreshToken();

            user.refreshToken = refreshToken;

            await user.save({ validateBeforeSave: false });
            return { accessToken, refreshToken };
      } catch (error) {
            throw new ApiError(
                  500,
                  "Something went wrong while generating access tokens",
            );
      }
};

const registerUser = asyncHandler(async (req, res) => {
      const { email, username, password, role } = req.body;

      const existedUser = await User.findOne({ 
            $or: [{ username }, { email }],
      });

      if (existedUser) {
            throw new ApiError(
                  409,
                  "User with username or email already exists",
                  [],
            );
      }

      const user = await User.create({
            email,
            password,
            username,
            isEmailVerified: false,
      });
      const { unHashedToken, HashedToken, tokenExpiry } =
            user.generateTemporaryToken();
      user.emailVerificationToken = HashedToken;
      user.emailVerificationExpiry = tokenExpiry;

      await user.save({ validateBeforeSave: false });

      await sendEmail({
            email: user?.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(
                  user.username,
                  `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`,
            ),
      });

      const createdUser = await User.findById(user._id).select(
            "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
      );
      if (!createdUser) {
            throw new ApiError(
                  500,
                  "Something went wrong while registering the user",
            );
      }
      return res
            .status(201)
            .json(
                  new ApiResponse(
                        200,
                        { user: createdUser },
                        "User registed successfully and verification email has been sent on your email",
                  ),
            );
});

const login = asyncHandler(async (req,res) => {
      const {email,password,username} = req.body
      if(!email) {
            throw new ApiError(400,"Email is required")
      }
      const user = await User.findOne({email})

      if(!user) {
            throw new ApiError(400,"User does not exist")
      }
      const isPasswordValid = await user.isPasswordCorrect(password)

      if(!isPasswordValid) {
            throw new ApiError(400,"Incorrect Password")
      }
      const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

      const loggedInUser = await User.findById(user._id).select(
            "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
      );

      const options = {
            httpOnly: true,
            secure: true
      }
      return res
            .status(200)
            .cookie("accessToken",accessToken,options)
            .cookie("refreshToken",refreshToken,options)
            .json(
                  new ApiResponse(
                        200,
                        {
                              user: loggedInUser,
                              accessToken,
                              refreshToken
                        },
                        "User login in sucessfully"
                  )
            )

})
const logoutUser = asyncHandler(async(req,res) => {
      await User.findByIdAndUpdate(
            req.user._id,
            {
                  $set: {
                        refreshToken: ""
                  }
            },
            {
                  new: true,
            }
      );
      const options = {
            httpOnly: true,
            secure: true
      }
      return res
            .status(200)
            .clearCookie("accessToken",options)
            .clearCookie("refreshToken",options)
            .json(
                  new ApiResponse(200,{},"User logged out")
            )
})
const getCurrentUser = asyncHandler(async (req,res) => {
      return res
            .status(200)
            .json(
                  new ApiResponse(
                        200,
                        req.user,
                        "Current user fetched successfully"
                  )
            )
})
const verifyEmail = asyncHandler(async (req,res) => {
      const {verificationToken} = req.params

      if(!verificationToken) {
            throw new ApiError(400,"Email verification token is missing");   
      }
      let HashedToken = crypto
            .createHash("sha256")
            .update(verificationToken)
            .digest("hex")

            const user = await User.findOne({
                  emailVerificationToken: HashedToken,
                  emailVerificationExpiry: {$gt: Date.now()}
            })
            if(!user) {
                  throw new ApiError(400,"Email verification token is missing");   
            }
            user.emailVerificationToken = undefined
            user.emailVerificationExpiry = undefined
            user.isEmailVerified = true
            await user.save({validateBeforeSave: false})

            return res
                  .status(200)
                  .json(
                        new ApiResponse(200,
                              {
                                    isEmailVerified: true
                              },
                              "Email is verified"
                        )
                  )
})
const resendEmailVerification = asyncHandler(async (req,res) => {
      const user = await User.findById(req.user?._id);

      if(!user) {
            throw new ApiError(404,"User does not exist");
      }
      if(user.isEmailVerified) {
            throw new ApiError(409,"Email is already verified");
      }
      const { unHashedToken, HashedToken, tokenExpiry } =
            user.generateTemporaryToken();
      user.emailVerificationToken = HashedToken;
      user.emailVerificationExpiry = tokenExpiry;

      await user.save({ validateBeforeSave: false });

      await sendEmail({
            email: user?.email,
            subject: "Please verify your email",
            mailgenContent: emailVerificationMailgenContent(
                  user.username,
                  `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`,
            ),
      });
      return res  
            .status(200)
            .json(
                  new ApiResponse(
                        200,
                        {},
                        "Mail has been sent to your email id "
                  )
            )
})
const refreshAccessToken = asyncHandler(async (req,res) => {
      const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

      if(!incomingRefreshToken) {
            throw new APiError(401,"Unauthorized access");
      }

      try {
            jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

            const user = await User.findById(decodedToken?._id)
            if(!user) {
                  throw new ApiError(401,"Invalid refresh token");
            } 
            if(incomingRefreshToken !== user?.refreshToken) {
                  throw new ApiError(401,"Refresh token is expired");
            }
            const options = {
                  httpOnly: true,
                  secure: true
            }
            const {accessToken,refreshToken: newRefreshToken} = await generateAccessAndRefreshTokens(user?._id)
           
            user.refreshToken = newRefreshToken
            await user.save()

            return res
                  .status(200)
                  .cookie("accessToken",options)
                  .cookie("refreshToken",newRefreshToken,options)
                  .json(
                        new ApiResponse(
                              200,
                              {accessToken, refreshToken: newRefreshToken},
                              "Access token refreshed"
                        )
                  )
      } catch (error) {
            throw new ApiError(401,"Invalid refresh Token");
      }
})
const forgotPasswordRequest = asyncHandler(async (req,res) => {
      const {email} = req.body
      const user = await User.findOne({email})

      if(!user) {
            throw new ApiError(404,"User does not exist",[]);
      }
      const {unHashedToken,HashedToken,tokenExpiry} = user.generateTemporaryToken()

      user.forgotPasswordToken = HashedToken
      user.forgotPasswordExpiry = tokenExpiry

      await user.save({validateBeforeSave: false})
      await sendEmail({
            email: user?.email,
            subject: "Password reset request",
            mailgenContent: forgotPasswordMailgenContent(
                  user.username,
                  `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`,
            ),
      });
      return res  
            .status(200)
            .json(
                  new ApiResponse(
                        200,
                        {},
                        "Password reset mail has been sent on your mail id"
                  )
            )
})
const resetForgotPassword = asyncHandler(async (req,res) => {
      const {resetToken} = req.params
      const {newPassword} = req.body

      let HashedToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex")

            const user = await User.findOne({
                  forgotPasswordToken: HashedToken,
                  forgotPasswordExpiry: {$gt: Date.now()}
            })
            if(!user) {
                  throw new ApiError(489,"Token is invalid or expired")
            }
            user.forgotPasswordExpiry = undefined
            user.forgotPasswordToken = undefined

            user.password = newPassword
            await user.save({validateBeforeSave: false})

            return res  
                  .status(200)
                  .json(
                        new ApiResponse(200),
                        {},
                        "Password reset successfully"
                  )
})
const changeCurrentPassword = asyncHandler(async (req,res) => {
      const {oldPassword,newPassword} = req.body

      const user = await User.findById(req.user?._id)
      const isPasswordValid = await user.isPasswordCorrect(oldPassword)
      if(!isPasswordValid) {
            throw new ApiError(400,"Invalid old Password");
      }
      user.password = newPassword

      await user.save({validateBeforeSave: false})

      return res  
            .status(200)
            .json(
                  new ApiResponse(
                        200,
                        {},
                        "Password changed successfully"
                  )
            )
})
export {
      registerUser,
      login,
      logoutUser,
      getCurrentUser,
      verifyEmail,
      resendEmailVerification,
      refreshAccessToken,
      forgotPasswordRequest,
      resetForgotPassword,
      changeCurrentPassword,
};
