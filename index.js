import signatureList from "./signature-list.js";

/**
 * @description 校验给出的字节数据是否符合某种MIME Type的signature
 * @param {Array} bufferss 字节数据
 * @param {Object} typeItem 校验项 { signature, offset  }
 */
const check = (bufferss, { signature, offset = 0 }) => {
  for (let i = 0, len = signature.length; i < len; i++) {
    // 传入字节数据与文件signature不匹配
    // 需考虑有offset的情况以及signature中有值为undefined的情况
    if (bufferss[i + offset] !== signature[i] && signature[i] !== undefined)
      return false;
  }
  return true;
};

/**
 * @description 获取文件二进制数据
 * @param {File} file 文件对象实例
 * @param {Object} options 配置项，指定读取的起止范围
 */
const getArrayBuffer = (file, { start, end }) => {
  return new Promise((reslove, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffers = new Uint8Array(e.target.result);
        reslove(buffers);
      };
      reader.onerror = (err) => reject(err);
      reader.onabort = (err) => reject(err);
      reader.readAsArrayBuffer(file.slice(start, end));
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * @description 获取文件的真实类型
 * @param {File} file 文件对象实例
 * @param {Object} options 配置项，指定读取的起止范围
 */
const getFileType = (file, options = { start: 0, end: 32 }) =>
  getArrayBuffer(file, options)
    .then((buffers) => {
      // 找出签名列表中定义好的类型，并返回
      for (let i = 0, len = signatureList.length; i < len; i++) {
        if (check(buffers, signatureList[i])) {
          const { mime, ext } = signatureList[i];
          return { mime, ext };
        }
      }
      // 未找到则返回file对象中的信息
      return { mime: file.type, ext: "" };
    })
    .catch((err) => err);

export default getFileType;
