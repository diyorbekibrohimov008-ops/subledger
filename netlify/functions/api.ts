import { createApp } from '../../src/server/app';
import { createServerlessStore } from '../../src/server/store';

const app = createApp({
  store: createServerlessStore(),
});

export default async (req: Request): Promise<Response> => {
  return app.fetch(req);
};

export const config = {
  path: '/api/*',
};
