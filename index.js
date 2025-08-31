import { body } from "express-validator";


const userRegisterValidator = () => {
      return [
            body("email")
                  .trim()
                  .notEmpty()
                  .withMessage("Email is required")
                  .isEmail()
                  .withMessage("Email is invalid"),
            body("username")
                  .trim()
                  .notEmpty()
                  .withMessage("Username is required")
                  .isLowercase()
                  .withMessage("Username must be in lower case")
                  .isLength({min: 3})
                  .withMessage("Username must be atleast 3 characters long"),
            body("password")
                  .trim()
                  .notEmpty()
                  .withMessage("Password can't be empty"),
            body("fullName")
                  .optional()
                  .trim()
                  .notEmpty()
                  .withMessage("fullName can't be empty")
      ]
}

const userLoginValidator = () => {
      return [
            body("email")
                  .optional()
                  .isEmail()
                  .withMessage("Email is invalid"),
            body("password")
                  .notEmpty()
                  .withMessage("Password can't be empty")
                  

      ]
}
const userChangeCurrentPasswordValidator = () => {
      return [
            body("oldPassword")
                  .notEmpty()
                  .withMessage("Password required"),
            body("newPassword")
                  .notEmpty()
                  .withMessage("Password required")
      ]
}
const userForgotPasswordValidator = () => {
      return [
            body("email")
                  .notEmpty()
                  .withMessage("Email is required")
                  .isEmail()
                  .withMessage("Email is invalid")
      ]
}
const userResetForgotPasswordValidator = () => {
      return [
            body("newPassword")
            .notEmpty()
            .withMessage("Password is required")
      ]
}
export {
      userRegisterValidator,
      userLoginValidator,
      userChangeCurrentPasswordValidator,
      userForgotPasswordValidator,
      userResetForgotPasswordValidator,
};