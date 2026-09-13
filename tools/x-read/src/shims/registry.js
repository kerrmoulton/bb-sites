export const commands={};
export function cli(def){if(def.access!=='read')throw new Error('WRITE_ADAPTER_FORBIDDEN');commands[def.name]=def;}
export const Strategy={COOKIE:'cookie',INTERCEPT:'intercept',PUBLIC:'public'};
