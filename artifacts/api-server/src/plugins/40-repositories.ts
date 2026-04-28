import fp from "fastify-plugin";
import { buildUsersRepository } from "../repositories/users";

export default fp(async function repositoriesPlugin(fastify) {
  fastify.decorate("usersRepository", buildUsersRepository(fastify.db));
}, {
  name: "repositories-plugin",
  dependencies: ["database-plugin"],
});
