export function allUrlHasValueInArray(arr: any[]) {
   if (!arr || arr.length === 0) {
     return false; // 数组不存在或为空
   }
 
   return arr.every((item) => {
     return item && item.url && typeof item.url === 'string' && item.url.trim() !== '';
   });
 }

 export function getCurrentDateTime() {
  const now = new Date(); // 获取当前时间

  const year = now.getFullYear(); // 获取年份
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 获取月份（注意：月份从0开始，所以要加1）
  const day = String(now.getDate()).padStart(2, '0'); // 获取日期

  // 拼接成所需格式
  const formattedDateTime = `${year}${month}${day}`;
  return formattedDateTime;
}