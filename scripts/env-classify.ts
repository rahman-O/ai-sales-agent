import { loadLocalEnv } from './load-local-env.ts';
import { classifyEnv, humanActionRequired } from './env-classify-lib.ts';

loadLocalEnv();
const result = classifyEnv();
console.log(
  JSON.stringify(
    {
      classifications: result.classifications,
      hostedReady: result.hostedReady,
      blockedReasons: result.blockedReasons,
      humanActionRequired: humanActionRequired(result),
    },
    null,
    2,
  ),
);
