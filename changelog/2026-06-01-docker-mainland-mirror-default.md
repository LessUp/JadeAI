# 2026-06-01 Docker 构建修复：默认切换中国大陆 Debian 镜像

## 问题

Docker 构建在 `apt-get install` 阶段偶发失败，典型报错：

- `Connection failed [IP: 199.232.162.132 80]`
- `Failed to fetch ... chromium ...`
- `Failed to fetch ... fonts-noto-cjk ...`

根因是默认使用 `deb.debian.org` / `deb.debian.org/debian-security`，在中国大陆网络环境中稳定性不足。

## 改动

更新 `Dockerfile` 的 base 阶段：

1. 将默认 build args 改为大陆可用镜像（清华）：
   - `DEBIAN_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian`
   - `DEBIAN_SECURITY_MIRROR=http://mirrors.tuna.tsinghua.edu.cn/debian-security`
2. 将镜像替换步骤提前到首次 `apt-get update` 之前，确保第一次 apt 拉取就走镜像源。
3. `sed` 匹配从固定 `http://` 改为 `https?://`，兼容上游源文件协议差异。
4. 默认镜像协议使用 `http`，避免基础镜像在安装 `ca-certificates` 之前访问 HTTPS 镜像时的证书链风险。

## 兼容性

- 仍可通过环境变量覆盖镜像：
  - `DEBIAN_MIRROR`
  - `DEBIAN_SECURITY_MIRROR`
- `docker:build` / `docker:run` / `docker:publish` / `docker:smoke` 脚本参数行为不变。
