/** Skill availability advice. Deployment receipts and runtime readiness are separate. */
const SETUP = 'bash "$DSH_HOME/redteam/setup.sh"'
const GENERIC_FIX = '先在环境适配页配置已有工具与当前任务所需前提；确需部署时显式选择固定版本和 SHA256 锁。'
  + ' `' + SETUP + ' --check` 只列离线文件与回执，不运行二进制。缺失项只阻塞依赖任务，不自动改配置或重启宿主。'
const ENV_SETUP = '由操作者在实际宿主环境中配置所需变量；部署脚本不代写 .env、不校验 API key 或连接 VPS。'
  + '需要重新加载环境时保留未生效原因并由操作者处理，不自动重启 DSH。'
const TOOLKIT_NOTE = '当前包包含固定部署脚本、下载助手和默认锁，不包含这些外部客户端或系统运行时。'

function pinnedTool(tool, what, location) {
  return { what, install: '优先配置已有工具路径 `' + location + '`；显式选择已审阅锁后用 `'
    + SETUP + ' --yes --tool=' + tool + ' --lock=/absolute/operator/tools-lock.json` 部署。'
    + '缺固定 tag/asset/SHA256 保持受阻，已有未认证或变更文件保留；仅显式 --force 才备份替换所选文件，部署不代表可运行。' }
}
function systemTool(what, packageName) {
  return { what, install: '优先使用当前平台已有工具；需要系统包 `' + packageName
    + '` 时由操作者明确选择版本。WSL 可用 wsl-install-tools.sh --apt-lock=/absolute/packages.lock，'
    + '每行 package=exact-version，复用已有源/索引；不自动更新源、代理或安装浮动版本。' }
}
function externalTool(what, location) {
  return { what, install: TOOLKIT_NOTE + ' 复用操作者现有 `' + location
    + '`，或显式选择官方固定发行和实际摘要后部署；按当前平台准备必要运行时，不猜图形会话或工具版本。' }
}
const FRP_FIX = pinnedTool('frp', 'frp 连接工具，frpc/frps 来自同一固定发行', '$DSH_HOME/redteam/toolkit/frp/')
const LIGOLO_FIX = pinnedTool('ligolo', 'ligolo-ng 连接工具，依赖准确的 proxy/agent 与当前平台能力', '$DSH_HOME/redteam/toolkit/ligolo/')

export const TOOL_FIXES = {
  fscan: pinnedTool('fscan', '范围内服务与安全检测，运行能力和候选证明分别核实', '$DSH_HOME/redteam/toolkit/fscan/fscan'),
  gogo: pinnedTool('gogo', '范围内测绘与指纹工具，按实际任务选择能力', '$DSH_HOME/redteam/toolkit/gogo/gogo'),
  suo5: pinnedTool('suo5', 'HTTP 连接工具，需任务明确的入口与连通前提', '$DSH_HOME/redteam/toolkit/suo5/suo5-linux-amd64'),
  chisel: pinnedTool('chisel', 'chisel 连接工具，随包空 pin 需操作者选择发行', '$DSH_HOME/redteam/toolkit/chisel/chisel'),
  frp: FRP_FIX, frpc: FRP_FIX, frps: FRP_FIX,
  subfinder: pinnedTool('subfinder', '被动子域线索收集', '$DSH_HOME/redteam/toolkit/subfinder/subfinder'),
  dnsx: pinnedTool('dnsx', '范围内 DNS 解析工具', '$DSH_HOME/redteam/toolkit/dnsx/dnsx'),
  naabu: pinnedTool('naabu', '范围内端口检测，发包能力依当前平台与任务预算', '$DSH_HOME/redteam/toolkit/naabu/naabu'),
  httpx: pinnedTool('httpx', 'ProjectDiscovery HTTP 工具，须与 Python httpx CLI 区分', '$DSH_HOME/redteam/toolkit/httpx/httpx'),
  ksubdomain: pinnedTool('ksubdomain', '范围内子域线索工具，需当前平台发包能力', '$DSH_HOME/redteam/toolkit/ksubdomain/ksubdomain'),
  ligolo: LIGOLO_FIX, 'ligolo-proxy': LIGOLO_FIX, 'ligolo-agent': LIGOLO_FIX,
  gowitness: pinnedTool('gowitness', '浏览器截图工具，另需实际可运行浏览器', '$DSH_HOME/redteam/toolkit/gowitness/gowitness'),
  oneforall: {
    what: 'OneForAll 固定源码与独立 Python 环境',
    install: '显式锁定源码归档摘要后用 `' + SETUP + ' --yes --tool=oneforall --lock=/absolute/operator/tools-lock.json`。'
      + '脚本仅部署所声明源码，不创建 venv 或安装浮动依赖；缺运行环境只阻塞此数据源。',
  },
  vps: { what: '当前任务所需的远端主机与连接身份', install: ENV_SETUP + ' 仅依赖远端设施的任务需要明确主机、用途、私钥路径和实际连接材料；不要求所有任务先配置 VPS。' },
  'nuclei-templates': {
    what: '与当前 nuclei 能力匹配的模板材料',
    install: '复用操作者现有模板路径，或显式固定模板发行/commit与摘要。setup 不更新模板，不以模板条数认定完整或可运行；扫描器命中先为候选。',
  },
  dirsearch: externalTool('目录与文件线索工具', '$DSH_HOME/redteam/toolkit/dirsearch/'),
  behinder: externalTool('操作者选定的客户端及模板', '$DSH_HOME/redteam/toolkit/Behinder/'),
  godzilla: externalTool('操作者选定的客户端', '$DSH_HOME/redteam/toolkit/Godzilla/'),
  antsword: externalTool('操作者选定的客户端与源码', '$DSH_HOME/redteam/toolkit/AntSword/'),
  netexec: systemTool('范围内协议与身份评估工具', 'netexec'),
  'pd-httpx': {
    what: '准确指向 ProjectDiscovery httpx 的现有包装入口',
    install: '先配置实际 httpx 二进制，直接引用其明确路径也可执行；需要包装入口时显式创建缺失路径，保留已有同名用户文件，不自动覆盖 ~/.local/bin。',
  },
  'kimi-chrome': externalTool('操作者现有浏览器启动入口', '~/.local/bin/kimi-chrome'),
  'kimi-webbridge': externalTool('操作者现有浏览器扩展及本地连接服务', '实际 WebBridge 安装路径'),
  chromium: { what: '当前平台的 Chromium 浏览器', install: '复用操作者已配置 executable，另核实实际可启动状态。不默认关闭浏览器沙箱，不假定 DISPLAY 或缓存版本；缺浏览器只阻塞浏览器依赖项。' },
  'playwright-cli': { what: '操作者已有固定版本的浏览器 CLI', install: '先配置已有 executable，并读取它的实际 help；不使用浮动 npx 或自动浏览器下载。内置评估复用 PURGE_PLAYWRIGHT_ROOT/实际 DSH_HOME 中已有 playwright 或 playwright-core，缓存与模块分开判断。' },
  nmap: systemTool('范围内端口与服务检测', 'nmap'),
  masscan: systemTool('范围内高速端口检测，需明确发包能力与预算', 'masscan'),
  nuclei: systemTool('固定模板安全检测，命中保留候选', 'nuclei'),
  sqlmap: systemTool('任务明确的 SQL 评估适配器', 'sqlmap'),
  ffuf: systemTool('范围内有界输入与目录探测', 'ffuf'),
  feroxbuster: systemTool('范围内目录线索工具', 'feroxbuster'),
  gobuster: systemTool('范围内目录/DNS/vhost 线索工具', 'gobuster'),
  hydra: systemTool('任务明确的认证评估工具', 'hydra'),
  john: systemTool('任务提供材料的离线哈希评估', 'john'),
  hashcat: systemTool('任务提供材料的离线哈希评估，需实际 CPU/GPU 能力', 'hashcat'),
  wpscan: systemTool('范围内 WordPress 安全评估，数据库来源另行固定', 'wpscan'),
  nikto: systemTool('范围内服务器配置检测', 'nikto'),
  whatweb: systemTool('范围内组件与指纹线索', 'whatweb'),
  amass: systemTool('范围内域名资产线索', 'amass'),
  theharvester: systemTool('公开来源线索收集', 'theharvester'),
  msfconsole: systemTool('任务明确的执行适配器及运行环境', 'metasploit-framework'),
  searchsploit: systemTool('本地公开案例检索，案例库独立固定来源', 'exploitdb'),
  proxychains4: { ...systemTool('当前任务明确的 TCP 代理入口', 'proxychains4'), install: systemTool('当前任务明确的 TCP 代理入口', 'proxychains4').install + ' 单任务配置使用明确临时文件，不改系统 proxychains 配置。' },
  socat: systemTool('任务明确的连接与读回工具', 'socat'),
  nc: systemTool('任务明确的连接工具', 'netcat-openbsd'),
  tmux: systemTool('现有后台任务的会话保持工具', 'tmux'),
  impacket: systemTool('范围内协议与实际身份评估套件', 'python3-impacket'),
  enum4linux: systemTool('范围内 SMB 线索与身份评估', 'enum4linux'),
  'redis-cli': systemTool('范围内 Redis 客户端', 'redis-tools'),
  mysql: systemTool('范围内数据库客户端', 'default-mysql-client'),
}

const BROWSER_FIX = TOOL_FIXES['playwright-cli'].install + ' ' + TOOL_FIXES.chromium.install
const REMOTE_FIX = ENV_SETUP + ' 只阻塞依赖该远端入口的任务；现有 HTTP/离线评估继续。'
const NATIVE_SKILL_FIX = '从当前安装的固定 runbook 读取技能与真实动作 help；文件/注册回执和实际运行分开记录。模型不能改运行时或外部工程。'
export const SKILL_FIXES = {
  'active-scan': TOOL_FIXES.nmap.install + ' ' + TOOL_FIXES.naabu.install,
  'asset-correlation': '纯台账任务复用当前已登记材料。缺技能时确认当前安装与技能根，保留用户文件；不要为此安装全部扫描器或改环境变量。',
  'browser-automation': BROWSER_FIX,
  'chisel-tunnel': TOOL_FIXES.chisel.install + ' ' + REMOTE_FIX,
  'cn-proxy-pool': '复用当前已配置的连接前提；只在单任务参数中指定代理，不修改系统源、代理或用户其他任务配置。',
  'credential-attack': TOOL_FIXES.hydra.install + ' ' + TOOL_FIXES.hashcat.install + ' 仅按当前任务明确范围、材料与预算使用，实际凭据通过句柄交接。',
  'dir-bruteforce': TOOL_FIXES.dirsearch.install,
  'fofa-recon': 'FOFA key 在操作者账户 API 设置取得，只对使用 FOFA 的任务构成前提。' + ENV_SETUP + ' 不把 key 写入任务书、报告或可见请求日志。',
  'frp-tunnel': FRP_FIX.install + ' ' + REMOTE_FIX,
  'fscan-intranet': TOOL_FIXES.fscan.install + ' 新网段只登记线索，实际请求须满足当前固定范围与连接前提。',
  'gogo-intranet': TOOL_FIXES.gogo.install + ' 不把扫描器指纹当作确认，不自动扩大到新发现网段。',
  'kimi-webbridge': TOOL_FIXES['kimi-webbridge'].install + ' ' + BROWSER_FIX,
  'lateral-movement': TOOL_FIXES.impacket.install + ' 仅安排当前任务书明确的身份与范围，不因发现凭据自动派发下一任务。',
  'nuclei-scan': TOOL_FIXES.nuclei.install + ' ' + TOOL_FIXES['nuclei-templates'].install,
  'passive-recon': '复用已有公开材料与当前可用数据源，缺某个 API key 只阻塞该数据源；线索、实际观察与未知覆盖分母分别交付。',
  'recon-pipeline': TOOL_FIXES.subfinder.install + ' ' + TOOL_FIXES.dnsx.install + ' 每个工具缺口独立保留，不要求先补齐全部流水线。',
  'redteam-setup': GENERIC_FIX + ' setup.sh、下载助手与默认锁由当前包分发；缺附件先确认安装与真实 DSH_HOME，不手造完成标记。',
  'shell-handler': TOOL_FIXES.socat.install + ' ' + REMOTE_FIX,
  'suo5-tunnel': TOOL_FIXES.suo5.install + ' ' + REMOTE_FIX,
  'unauth-exploit': TOOL_FIXES['redis-cli'].install + ' ' + TOOL_FIXES.mysql.install + ' 保留实际身份、资源和变更前提，普通结果不独立证明权限。',
  'vps-reverse-shell': REMOTE_FIX + ' 由操作者明确当前远端主机、用途和密钥路径，部署助手不创建连接脚本、不开放端口或连接远端。',
  'web-fingerprint': TOOL_FIXES.httpx.install + ' 指纹与版本为线索，不授予漏洞确认。',
  'webshell-toolkit': TOOL_FIXES.behinder.install + ' ' + TOOL_FIXES.godzilla.install,
  'assessment-evidence': NATIVE_SKILL_FIX + ' 模型只登记 claimed/inferred；当前精确原生证明、可信采集回执与完整材料才支持确认。',
  'src-discovery': NATIVE_SKILL_FIX + ' SRC 凭据、写入和委派入口保持拒绝，持久直接证据停止不撤销。',
  'pentest-discovery': NATIVE_SKILL_FIX + ' 缺 browser/identity/fixture 只阻塞依赖项；真实完整控制、失败 run 和待复核分母保留。',
}

/* ── 内部工具 ─────────────────────────────────────────────────────────────── */

/** 常见扩展名（`fscan_windows_x64.exe`、`vps.sh`、`godzilla.jar` …）。 */
const EXT_RE = /\.(exe|zip|tar\.gz|tgz|gz|bz2|xz|jar|sh|py|bin|txt|md|json)$/i
/** 平台后缀（`_windows_x64`、`-linux-amd64`、`_darwin_arm64` …）。 */
const PLATFORM_RE = /[-_](windows|win32|win64|win|linux|darwin|macos|osx|freebsd)[-_][a-z0-9_.]+$/
/** 架构后缀（裸的 `_amd64` / `-arm64`）。 */
const ARCH_RE = /[-_](amd64|x86_64|x64|arm64|aarch64|arm|386|i386|i686|mips[a-z0-9]*)$/

/**
 * 把二进制/目录名字清成工具名：剥扩展名、剥平台与架构后缀、转小写。
 * 清完不含 ASCII 字母（例如 `清单.md`、纯符号）就返回 null —— 那就不是工具名。
 */
function cleanToolName(raw) {
  let out = String(raw == null ? '' : raw).trim()
  if (out === '') return null
  out = out.replace(EXT_RE, '')
  let prev = ''
  while (out !== '' && out !== prev) {
    prev = out
    out = out.replace(PLATFORM_RE, '').replace(ARCH_RE, '')
  }
  out = out.toLowerCase()
  return /[a-z]/.test(out) ? out : null
}

/**
 * 从路径里抽工具名（抽不出来返回 `null`）。
 *   · `…/redteam/toolkit/<工具>/…` → `toolkit/` 之后的第一段目录名（`suo5-linux-amd64` → `suo5`）
 *   · `~/.local/bin/xxx`、`/usr/bin/xxx`、`~/.local/xxx` → 文件名
 *   · 裸名字（`fscan_windows_x64.exe`、`gogo_linux_arm64`）→ 剥平台后缀后的名字
 *   · 其它路径（`/usr/share/wordlists/rockyou.txt`、`skills/x.md`）→ `null`
 */
export function toolNameOfPath(p) {
  if (typeof p !== 'string') return null
  const s = p.trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[，。；、：,;:)\]}>）】]+$/, '')
    .replace(/\\/g, '/')
  if (s === '') return null
  let candidate = null
  const at = s.lastIndexOf('toolkit/')
  if (at !== -1) {
    candidate = s.slice(at + 'toolkit/'.length).split('/').filter((seg) => seg !== '')[0] || null
  } else if (/\/bin\//.test(s) || /(^|\/)\.local\//.test(s)) {
    const segs = s.split('/').filter((seg) => seg !== '')
    candidate = segs.length > 0 ? segs[segs.length - 1] : null
  } else if (!s.includes('/')) {
    candidate = s
  }
  return candidate === null ? null : cleanToolName(candidate)
}

/** 别名的规范化：`impacket-wmiexec` 这类命令归到 `impacket` 这一条修法上。 */
function canonicalTool(name) {
  const n = String(name || '')
  if (n.startsWith('impacket-')) return 'impacket'
  if (n.startsWith('enum4linux-')) return 'enum4linux'
  return n
}

/** 环境变量怎么拿（拿不准的就不编，直接让用户填值）。 */
const ENV_HINTS = {
  FOFA_KEY: '由操作者从 <https://fofa.info> 账户 API 设置取得，仅使用 FOFA 的任务依赖；不将值放入可见命令、任务书或报告',
  REDTEAM_VPS_HOST: '填 VPS 登录地址 `用户@主机`（例如 `export REDTEAM_VPS_HOST=ubuntu@203.0.113.10`）',
  REDTEAM_VPS_USER: '填 VPS 登录用户（默认 `ubuntu`）',
  REDTEAM_VPS_KEY: '填 VPS 私钥路径（默认 `$DSH_HOME/redteam/toolkit/vps/id_rsa`，权限必须 `chmod 600`）',
}

function asArray(v) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim() !== '')
  if (typeof v === 'string' && v.trim() !== '') return [v]
  return []
}

/**
 * 由 `skill-availability.js` 的判定生成一条中文修复建议。
 *
 * @param issue - `{ kind, skill, paths?, env?, placeholder? }`，
 *   `kind` ∈ `'file-missing' | 'content-missing' | 'env-missing' | 'path-missing' | 'placeholder' | 'shadowed'`。
 *   也接受 `checkSkill()` 返回的 `problems` 之外的补充字段；字段类型宽松（字符串或数组都行）。
 * @returns 一条中文建议（不含换行；命令都在反引号里）。拿不准时回退到 `SKILL_FIXES[skill]`，再回退到通用建议。
 */
export function fixesForIssue(issue) {
  const it = issue && typeof issue === 'object' ? issue : {}
  const kind = typeof it.kind === 'string' ? it.kind : ''
  const skill = typeof it.skill === 'string' ? it.skill : ''
  const skillName = skill === '' ? '<技能名>' : skill
  const skillHint = skill !== '' && Object.prototype.hasOwnProperty.call(SKILL_FIXES, skill) ? SKILL_FIXES[skill] : ''
  const parts = []

  if (kind === 'path-missing') {
    const tools = []
    const seen = new Set()
    for (const p of asArray(it.paths)) {
      const name = toolNameOfPath(p)
      if (name === null) continue
      const canon = canonicalTool(name)
      if (seen.has(canon)) continue          // 同一个工具只列一次
      seen.add(canon)
      tools.push({ name, canon, path: p })
    }
    if (tools.length > 0) {
      const items = tools.map(({ name, canon, path }) => {
        const fix = Object.prototype.hasOwnProperty.call(TOOL_FIXES, canon) ? TOOL_FIXES[canon] : null
        if (fix === null) {
          return '`' + name + '`（' + path + '）：先配置已有工具的实际路径；需要部署时明确平台、固定发行与摘要，'
            + '随包锁没有该工具就保留未实现原因，不默认下载或覆盖文件'
        }
        return '`' + name + '`（' + path + '）：' + fix.what + '。修法：' + fix.install
      })
      parts.push('缺 ' + tools.length + ' 个工具，逐条修：' + items.join('；'))
      parts.push('缺失工具只阻塞依赖它的任务。`' + SETUP + ' --check` 仅列离线清单；实际能力探测与目标测试分别记录，不自动执行下载或重启。')
    }
  } else if (kind === 'env-missing') {
    const names = asArray(it.env)
    if (names.length > 0) {
      const items = names.map((n) => {
        const hint = Object.prototype.hasOwnProperty.call(ENV_HINTS, n) ? ENV_HINTS[n] : '值由你自己提供'
        return '`' + n + '`：由操作者在实际宿主环境中配置（' + hint + '）'
      })
      parts.push('缺环境变量：' + items.join('；') + '。')
      parts.push(ENV_SETUP + ' 缺失变量只阻塞实际使用它的任务，其他已有前提的工作继续。')
    }
  } else if (kind === 'placeholder') {
    const ph = typeof it.placeholder === 'string' && it.placeholder.trim() !== '' ? it.placeholder.trim() : '外部基础设施地址'
    parts.push('技能正文里 `' + ph + '` 仍是占位符，对应前提尚未明确。')
    parts.push('先确定当前任务是否依赖它；确需该值时由操作者配置实际环境或自己的技能副本，不修改随包模板冒充运行成功。' + ENV_SETUP)
  } else if (kind === 'shadowed') {
    parts.push('技能被同名版本盖住了：`' + skillName + '` 在别的技能根里还有一份（配置更全）的同名技能，'
      + '但按当前技能根顺序加载的是排在前面那份不完整的。')
    parts.push('修法：在技能目录设置中明确优先使用已有配置的技能根，保留用户两份原文；需要重新加载时由操作者处理，不自动删除文件或重启。')
  } else if (kind === 'file-stale') {
    parts.push('技能记录的文件路径在本机不存在（技能正文仍能加载，不影响调用）：这类路径是上一次在某台机器上解析出来的绝对路径，换机器必然指空。')
    parts.push('先确认当前安装、实际 DSH_HOME 和技能根。随包技能在加载时同步到本实例管理的目录；历史绝对路径不证明当前可用，不为了消除提示自动切换实例或重启。')
  } else if (kind === 'file-missing') {
    parts.push('技能文件不存在：确认当前包版本与技能根，恢复当前安装的缺失随包资源；用户自定义同名文件保留，不自动全量覆盖、安装另一实例或重启。')
    parts.push('若是自己放的技能，确认文件在技能根下且文件名与技能名一致（`<技能名>.md`）。')
  } else if (kind === 'content-missing') {
    parts.push('技能正文读不到，只有元数据，不能判定可用性：确认当前安装资源与已选技能根；远端源保留读取失败原因，不用全量覆盖或自动重启代替诊断。')
    parts.push('临时要确认能不能用，直接让智能体用 `skill` 工具实际加载一次 `' + skillName + '`。')
  }

  if (parts.length === 0) parts.push(skillHint !== '' ? skillHint : GENERIC_FIX)
  return parts.join(' ')
}
