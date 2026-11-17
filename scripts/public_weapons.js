// The user's explicit public weapon selection; all other native imports stay local.
export const PUBLIC_CF_WEAPONS=Object.freeze({cfv_m4a1:'m4a1_conv',cfv_deagle:'deagle_conv'});
export const publicDeployment=()=>/\.github\.io$/i.test(globalThis.location?.hostname || '') ||
  new URLSearchParams(globalThis.location?.search || '').has('publicDeploy');
