import multipart from "@fastify/multipart";
import fp from "fastify-plugin";

export default fp(async function multipartPlugin(fastify) {
  await fastify.register(multipart, {
    attachFieldsToBody: false,
    limits: {
      files: 1,
      fileSize: 1024 * 1024 * 500,
    },
  });
}, {
  name: "multipart-plugin",
});
