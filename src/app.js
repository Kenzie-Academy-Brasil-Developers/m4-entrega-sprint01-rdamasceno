import express, { response } from "express";
import users from "./database";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());
const port = 3001;

//SERVICES
const createUserService = (userData) => {

  const emailAlreadyExists = users.find((el) => el.email === userData.email);

  if (emailAlreadyExists) {
    return [409, {error: "Email already exists!"}];
  }
  const newUser = {
    uuid: uuidv4(),
    ...userData,
    createdAt: new Date()
  };

  users.push(newUser);
  return [201, newUser];
};

//CONTROLLER
const createUserController = (request, response) => {
  const [status, data] = createUserService(request.body);
  return response.status(status).json(data);
};

//ROUTES
app.post("/users", createUserController);

app.listen(port, () => {
  console.log(`The server is running in port ${port}`);
});
