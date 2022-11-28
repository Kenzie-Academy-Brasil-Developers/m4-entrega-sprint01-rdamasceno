import express, { request } from "express";
import users from "./database";
import { v4 as uuidv4 } from "uuid";
import { compare, hash } from "bcryptjs";
import "dotenv/config";
import jwt, { decode } from "jsonwebtoken";

const app = express();
app.use(express.json());
const port = 3000;

//MIDDLEWARES
const verifyEmailMiddleware = (request, response, next) => {
  const emailAlreadyExists = users.find(
    (el) => el.email === request.body.email
  );

  if (emailAlreadyExists) {
    return response.status(409).json({ message: "E-mail already registered" });
  }
  return next();
};

const ensureAuthMiddleware = (request, response, next) => {
  let authorization = request.headers.authorization;

  if (!authorization) {
    return response.status(401).json({
      message: "Missing authorization headers",
    });
  }

  authorization = authorization.split(" ")[1];

  return jwt.verify(authorization, process.env.SECRET_KEY, (error, decoded) => {
    if (error) {
      return response.status(401).json({
        message: "Missing authorization headers",
      });
    }

    request.user = {
      id: decoded.sub,
      isAdm: decoded.isAdm,
    };
    return next();
  });
};

const isAdminMiddleware = (request, response, next) => {
  const user = users.find((el) => el.isAdm === request.user.isAdm);

  if (user.isAdm === false) {
    console.log(user.isAdm);
    return response.status(403).json({
      message: "missing admin permissions",
    });
  }
  return next();
};

const ensureUserExistsMiddleware = (request, response, next) => {
  const userIndex = users.findIndex((el) => el.uuid === request.params.id);
  console.log(userIndex);

  if (userIndex === -1) {
    return response.status(404).json({ message: "User not found!" });
  }
  request.foundUser = users[userIndex];
  request.userIndex = userIndex;

  return next();
};

//SERVICES
const createUserService = async (userData) => {
  const newUser = {
    uuid: uuidv4(),
    createdOn: new Date(),
    updatedOn: new Date(),
    isAdm: false,
    ...userData,
    password: await hash(userData.password, 10),
  };

  users.push(newUser);
  const { password, ...rest } = newUser;
  return [201, rest];
};

const createSessionService = async ({ email, password }) => {
  const user = users.find((el) => el.email === email);

  if (!user) {
    return [
      401,
      {
        message: "Wrong email/password",
      },
    ];
  }

  const passwordMatch = await compare(password, user.password);

  if (!passwordMatch) {
    return [401, { message: "Wrong email/password" }];
  }

  const token = jwt.sign(
    {
      isAdm: user.isAdm,
    },
    process.env.SECRET_KEY,
    {
      expiresIn: "24h",
      subject: user.uuid,
    }
  );
  return [200, { token }];
};

const listUsersService = (name) => {
  if (name) {
    const filteredUsers = users.filter((el) => el.name === name);
    return [200, filteredUsers];
  }

  return [200, users];
};

const listUserProfileService = (id) => {
  const user = users.find((el) => el.uuid === id);

  if (!user) {
    return [
      401,
      {
        message: "Missing authorization headers",
      },
    ];
  }

  const { password, ...rest } = user;
  return [200, rest];
};

const updateUserService = async (userIndex, payload, decoded, paramsId) => {
  console.log(payload);
  const user = users[userIndex];
  console.log(user);
  if (payload.password) {
    payload.password = await hash(payload.password, 10);
  }
  if (decoded.isAdm) {
    users[userIndex] = { ...users[userIndex], ...payload };
    const user = users[userIndex];
    const { password, ...rest } = user;
    return [200, rest];
  }

  if (decoded.id === paramsId) {
    users[userIndex] = { ...users[userIndex], ...payload };
    const user = users[userIndex];
    const { password, ...rest } = user;
    return [200, rest];
  }
  return [
    403,
    {
      message: "missing admin permissions",
    },
  ];
};

const deleteUserService = (id, decoded) => {
  if (decoded.isAdm) {
    console.log(decoded.isAdm);

    const user = users.findIndex((el) => el.id === id);

    users.splice(user, 1);
    return [204, {}];
  }

  if (id === decoded.id) {
    const user = users.findIndex((el) => el.id === id);
    users.splice(user, 1);
    return [204, {}];
  }

  return [
    403,
    {
      message: "missing admin permissions",
    },
  ];
};

//CONTROLLER
const createUserController = async (request, response) => {
  const [status, data] = await createUserService(request.body);
  return response.status(status).json(data);
};

const createSessionController = async (request, response) => {
  const [status, data] = await createSessionService(request.body);
  return response.status(status).json(data);
};

const listUsersController = (request, response) => {
  const [status, data] = listUsersService(request.query.name);
  return response.status(status).json(data);
};

const listUserProfileController = (request, response) => {
  const [status, data] = listUserProfileService(request.user.id);
  return response.status(status).json(data);
};

const updateUserController = async (request, response) => {
  const [status, data] = await updateUserService(
    request.userIndex,
    request.body,
    request.user,
    request.params.id
  );

  return response.status(status).json(data);
};

const deleteUserController = (request, response) => {
  const { id } = request.params;

  const [status, data] = deleteUserService(id, request.user);
  return response.status(status).json(data);
};

//ROUTES
app.post("/users", verifyEmailMiddleware, createUserController);
app.post("/login", createSessionController);
app.get("/users", ensureAuthMiddleware, isAdminMiddleware, listUsersController);
app.get("/users/profile", ensureAuthMiddleware, listUserProfileController);
app.patch(
  "/users/:id",
  ensureAuthMiddleware,
  ensureUserExistsMiddleware,
  updateUserController
);
app.delete("/users/:id", ensureAuthMiddleware, deleteUserController);

app.listen(port, () => {
  console.log(`The server is running in port ${port}`);
});

export default app;
