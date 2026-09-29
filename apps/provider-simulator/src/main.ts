import { createMetaSimulator } from './server.js';

if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
  throw new Error('provider_simulator_refuses_production');
}
const secret = process.env.META_WHATSAPP_APP_SECRET ?? 'mb15a-simulator-secret';
const port = Number(process.env.META_SIMULATOR_PORT ?? 3415);
const containerMode = process.env.SIMULATOR_CONTAINER_MODE === 'true';
const host = containerMode ? '0.0.0.0' : '127.0.0.1';
const simulator = createMetaSimulator({ secret, port, host, allowContainerBind: containerMode });
await simulator.listen();
console.log(JSON.stringify({ msg: 'meta_simulator_ready', host, port }));
