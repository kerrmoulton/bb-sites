const nope=()=>{throw new Error('LOCAL_FILE_IO_REQUIRES_EXTERNAL_RUNNER');};
export const existsSync=()=>false;
export const statSync=nope,readFileSync=nope,writeFileSync=nope,appendFileSync=nope,mkdirSync=nope,renameSync=nope,rmSync=nope,mkdtempSync=nope,unlinkSync=nope;
export default {existsSync,statSync,readFileSync,writeFileSync,appendFileSync,mkdirSync,renameSync,rmSync,mkdtempSync,unlinkSync};
