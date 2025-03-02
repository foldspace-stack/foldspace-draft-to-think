export function allUrlHasValueInArray(arr: any[]) {
   if (!arr || arr.length === 0) {
     return false; // 数组不存在或为空
   }
 
   return arr.every((item) => {
     return item && item.url && typeof item.url === 'string' && item.url.trim() !== '';
   });
 }