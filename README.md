# JS 检测上传文件类型

# 前言

在前端，文件上传是很常见的功能。通常，我们可以为文件上传`input`框添加`accept`属性，以限制其可接受的格式，如下所示：

```html
<input type="file" accept="image/png" />
```

但是上述代码有两个弊端，一是用户可以在文件上传框中取消格式限制而使不符合既定格式的文件被上传；二是用户可以手动修改文件后缀名以绕过格式限制，从而上传成功。所以需要另一种方式更加精准地获取上传文件类型。

# 文件签名

在文件二进制数据中，包含着文件签名，是用于标识或验证文件内容的数据，可以通过文件签名来判断文件的类型。这样的签名也被称为魔术数字(Magic Numbers)或魔术字节(Magic Bytes)。以 png 文件为例，其 16 进制签名字串为`89 50 4E 47 0d 0A 1A 0A`，MIME 类型为`image/png`。

以[hexyl](https://github.com/sharkdp/hexyl)命令行工具为例，查看一张 png 图片的十六进制数据，如下所示：
![利用hexyl查看文件十六进制数据](https://jealyn-1258764186.file.myqcloud.com/571621506096_.pic_hd.jpg)

将后缀修改为 mp4 后，再次查看，数据结果一致。
![修改后缀后再次查看](https://jealyn-1258764186.file.myqcloud.com/581621506369_.pic_hd.jpg)

# 定义文件签名列表

我们需要定义一组文件签名-MIME 类型-文件后缀的映射数组表，以方便后续根据文件签名表判断传入数据对应的文件格式。下面列举一部分文件签名，完整签名可参考[wikipedia](https://en.wikipedia.org/wiki/List_of_file_signatures)和[whatwg](https://mimesniff.spec.whatwg.org/#matching-a-mime-type-pattern)。
| 文件十六进制签名 | offset | MIME 类型 | 文件后缀 |
| ----------------------- | ------ | --------------- | -------- |
| 25 50 44 46 2D | 0 | application/pdf | pdf |
| FF D8 FF | 0 | image/jpeg | jpg,jpeg |
| 89 50 4E 47 0D 0A 1A 0A | 0 | image/png | png |
| 66 74 79 70 69 73 6F 6D | 4 | video/mp4 | mp4 |
| 47 49 46 38 37 61 | 0 | image/gif | gif |
| 49 44 33 | 0 | audio/mpeg | mp3 |
| 46 4C 56 | 0 | video/x-flv | flv |
| 4F 67 67 53 | 0 | application/ogg | ogg,oga,ogv |
| 52 61 72 21 1A 07 00 | 0 | application/x-rar-compressed | rar |

在 JS 中，可建立如下签名列表：

```js
[
  {
    mime: "video/mp4", // MIME Type
    ext: "mp4", // Extension(s)
    offset: 4, // Offset
    signature: [0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], // Hex Signature
  },
  // ... more
];
```

# 读取文件二进制数据

下一步，我们只需要读取上传文件的二进制数据，获取其字节数据。可以通过 `FileReader` API 来读取文件内容。由于文件签名通常比较短，所以只需要读取部分范围的值即可。

```js
/**
 * @description 获取文件二进制数据
 * @param {File} file 文件对象实例
 * @param {Object} options 配置项，指定读取的起止范围
 */
const getArrayBuffer = (file, { start = 0, end = 32 }) => {
  return new Promise((reslove, reject) => {
    try {
      // 定义FileReader实例
      const reader = new FileReader();
      reader.onload = (e) => {
        // 获取文件二进制数据
        const buffers = new Uint8Array(e.target.result);
        reslove(buffers);
        // 以一个png图片为例，其数据如下：
        // Uint8Array(32) [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 64, 0, 0, 0, 64, 8, 6, 0, 0, 0, 170, 105, 113]
      };
      reader.onerror = (err) => reject(err);
      reader.onabort = (err) => reject(err);
      // 读取文件
      reader.readAsArrayBuffer(file.slice(start, end));
    } catch (err) {
      reject(err);
    }
  });
};
```

上面定义了`getArrayBuffer`函数用来读取文件二进制数据，返回一个`Promise`以实现更好的错误控制和异步处理。

# 获取文件真实类型

首先定义一个 `check` 函数，检查传入数据是否符合某文件类型的签名字串，符合则返回 `true`，否则返回 `false`。

```js
/**
 * @description 校验给出的字节数据是否符合某种MIME Type的signature
 * @param {Array} buffers 字节数据
 * @param {Object} typeItem 校验项 { signature, offset  }
 */
const check = (buffers, { signature, offset = 0 }) => {
  for (let i = 0, len = signature.length; i < len; i++) {
    // 传入字节数据与文件signature不匹配
    // 需考虑有offset的情况以及signature中有值为undefined的情况
    if (buffers[i + offset] !== signature[i] && signature[i] !== undefined)
      return false;
  }
  return true;
};
```

然后再遍历文件签名列表，对每个签名项调用`check`函数，获取文件真实类型。如果遍历完成仍无匹配结果，则返回 file 对象中的信息。最终封装成一个`getFileType`方法，如下所示：

```js
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
```

# 效果查看

将 png 格式文件修改为 jpg 后缀后，点击文件上传按钮，获取的 File 对象和通过`getFileType`方法得到的信息如下所示。

![格式对比](https://jealyn-1258764186.file.myqcloud.com/591621567338_.pic.jpg)

# 总结

本文分享了使用 JS 读取文件二进制，然后根据签名判断文件真实类型，并给出了具体的代码实现。不过需注意，本示例并未对完整的文件类型进行判断。完整的文件签名列表可点击[List of file signatures](https://en.wikipedia.org/wiki/List_of_file_signatures)查看，完整的 MIME type 列表可点击[Media Types](https://www.iana.org/assignments/media-types/media-types.xhtml)查看。实际项目中，可使用[file-type](https://github.com/sindresorhus/file-type)库进行类型判断。

# 参考链接

- [file-type](https://github.com/sindresorhus/file-type)
- [ MIME type pattern](https://mimesniff.spec.whatwg.org/#matching-a-mime-type-pattern)
- [List of file signatures](https://en.wikipedia.org/wiki/List_of_file_signatures)
- [Media Types](https://www.iana.org/assignments/media-types/media-types.xhtml)
- [hexyl](https://github.com/sharkdp/hexyl)
- [FileReader | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/FileReader)
