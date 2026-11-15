# WordNest 单词记忆

一个零依赖、可离线使用的本地背单词小程序。数据保存在浏览器 `localStorage`，适合直接放进 Git 仓库，也可以部署到 GitHub Pages。

## 功能

- 单词、释义、音标、例句、标签和词书管理
- 基于记忆评分的间隔复习
- 闪卡、拼写、四选一三种学习模式
- 浏览器英文发音（Web Speech API）
- 每日目标、连续打卡、经验值和掌握状态
- 7 日柱状图、91 日热力图、学习历史与正确率
- 搜索、筛选、批量删除
- JSON 完整备份与恢复、CSV 导入导出
- 深色模式、响应式移动端布局
- PWA 离线缓存，可安装到桌面

## 本机运行

本项目没有第三方依赖。推荐在项目目录启动静态服务器：

```bash
# Python 3
python -m http.server 8080
```

然后访问 <http://localhost:8080>。

也可以使用 Node.js：

```bash
npx serve .
```

直接双击 `index.html` 也能使用主要功能，但 PWA 离线缓存需要通过 `http://localhost` 访问。

## 上传 GitHub

```bash
git init
git add .
git commit -m "feat: add WordNest vocabulary app"
git branch -M main
git remote add origin https://github.com/你的用户名/wordnest.git
git push -u origin main
```

如需 GitHub Pages，在仓库的 **Settings → Pages** 中选择从 `main` 分支根目录发布即可。

## CSV 格式

首行字段为：

```csv
word,phonetic,meaning,example,deck,tags
```

`tags` 中的多个标签使用 `|` 分隔。建议先从应用里导出一次 CSV，按相同格式编辑后再导入。

## 项目结构

```text
word-memory-app/
├─ assets/icon.svg
├─ index.html
├─ styles.css
├─ app.js
├─ manifest.webmanifest
├─ sw.js
├─ README.md
├─ LICENSE
└─ .gitignore
```

## 数据说明

- 浏览器数据键名：`wordnest-data-v1`
- 清除站点数据会删除学习进度，请定期导出 JSON 备份
- 项目不上传任何个人学习数据，也不需要账号或网络接口

## License

MIT
