/**
 * Obsidian Prism — Channel 4 Reverse English Restoration Rules (hostLocalization: 'off')
 * Zero-dependency UMD module exposing:
 *   - CommonJS: module.exports
 *   - Browser / Electron: globalThis.__agPrismHostI18nReversePatterns
 *
 * Guarantees:
 *   1. REVERSE_EXACT_OVERRIDES < 2 KB compact disambiguation & external zh-CN Chrome UI overrides
 *   2. Every pattern in REVERSE_PATTERNS is strictly anchored (^...$) to prevent prose corruption
 *   3. REVERSE_CROSS_NODE_RULES symmetrically restores cross-TextNode templates in host-i18n-runtime.js
 */
(function (root, factory) {
  var api = factory();
  if (root) {
    root.__agPrismHostI18nReversePatterns = api;
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var REVERSE_EXACT_OVERRIDES = Object.assign(Object.create(null), {
    设置: 'Settings', 应用设置: 'App Settings', 偏好设置: 'Preferences', 操作: 'Action',
    关闭: 'Close', 取消: 'Cancel', 删除: 'Delete', 保存: 'Save', 复制: 'Copy', 搜索: 'Search',
    新建: 'New', 文件: 'File', 编辑: 'Edit', 视图: 'View', 转到: 'Go', 终端: 'Terminal',
    帮助: 'Help', 扩展: 'Extensions', 外观: 'Appearance', 通用: 'General', 账户: 'Account',
    历史: 'History', 模型: 'Model', 计划: 'Plan', 套餐方案: 'Plan', 智能体: 'Agent', 代理: 'Agent',
    工作区: 'Workspace', 会话: 'Conversation', 对话: 'Conversation', 收件箱: 'Inbox',
    通知: 'Notifications', 思考: 'Thought', 继续: 'Continue', 重试: 'Retry', 接受: 'Accept',
    拒绝: 'Reject', 允许: 'Allow', 禁止: 'Deny', 启用: 'Enable', 禁用: 'Disable', 打开: 'Open',
    重置: 'Reset', 重新加载: 'Reload', 刷新: 'Refresh', 安装: 'Install', 卸载: 'Uninstall',
    更新: 'Update', 导出: 'Export', 导入: 'Import', 清除: 'Clear', 筛选: 'Filter', 排序: 'Sort',
    详情: 'Details', 概览: 'Overview', 调试: 'Debug', 运行: 'Run', 停止: 'Stop', 暂停: 'Pause',
    恢复: 'Resume', 选择: 'Select', 完成: 'Done', 提交: 'Submit', 退出: 'Exit', 收起: 'Collapse',
    撤销: 'Undo', 新建会话: 'New Conversation', 新建对话: 'New Conversation', 插件: 'Plugins',
    子智能体: 'Subagents', 定时任务: 'Scheduled Tasks', 'MCP 工具': 'MCP Tools',
    'UI 扩展': 'UI Extensions', 自主模式: 'Autonomous Mode', 高对比度: 'High Contrast',
    已完成: 'Completed', 处理中: 'In Progress', 立即发送: 'Send Now', 刚刚: 'Just now',
    今天: 'Today', 昨天: 'Yesterday', 登录: 'Sign In', 退出登录: 'Sign Out',
    置顶会话: 'Pinned', 新对话: 'New Conversation', 帐户: 'Account', 编辑器: 'Editor',
    隐私: 'Privacy', 系统: 'System', 主题: 'Theme', 字体: 'Font', 思考中: 'Thinking',
    发送: 'Send', 所有项目: 'All Projects', 最近对话: 'Recent Conversations',
    最近会话: 'Recent Conversations', 当前会话: 'Current Conversation',
    扩展程序: 'Extensions', 键盘快捷键: 'Keyboard Shortcuts', 登出: 'Sign Out',
    升级: 'Upgrade', 开启: 'On', 恢复默认: 'Reset to Default', 折叠: 'Collapse', 极速: 'Turbo',
    即将下线: 'Leaving Soon', 提示: 'Notice', 用量: 'Usage', 周限额: 'Weekly limit',
    查看用量明细: 'View Usage', 'Gemini 模型': 'Gemini Models', 'Claude 与 GPT 模型': 'Claude and GPT models',
    '将常规步骤分流给更快的执行器。质量不变，Token 消耗更少。': 'Offloads routine steps to a faster executor. Same quality, fewer tokens used.',
    适合大多数深度推理与复杂问题: 'For most deep reasoning and complex problems',
    适合最具挑战性的长周期任务: 'For your hardest, long-horizon tasks',
    兼顾执行任务的速度与效率: 'For speed and efficiency in execution tasks',
    网页: 'Web',
  });

  var REVERSE_PATTERNS = [
    // 1. Thought / Thinking / Worked / Stopped / Timed durations
    {
      regex: '^(?:已思考|思考了)\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Thought for $1h $2m $3s',
    },
    {
      regex: '^(?:已思考|思考了)\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?$',
      replacement: 'Thought for $1h $2m',
    },
    {
      regex: '^(?:已思考|思考了)\\s*(\\d+)\\s*小时$',
      replacement: 'Thought for $1h',
    },
    {
      regex: '^(?:已思考|思考了)\\s*(\\d+)\\s*分(?:钟)?\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Thought for $1m $2s',
    },
    {
      regex: '^(?:已思考|思考了)\\s*(\\d+)\\s*分(?:钟)?$',
      replacement: 'Thought for $1m',
    },
    {
      regex: '^(?:已思考|思考了)\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Thought for $1s',
    },
    {
      regex: '^正在思考\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Thinking for $1h $2m $3s',
    },
    {
      regex: '^正在思考\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?$',
      replacement: 'Thinking for $1h $2m',
    },
    {
      regex: '^正在思考\\s*(\\d+)\\s*小时$',
      replacement: 'Thinking for $1h',
    },
    {
      regex: '^正在思考\\s*(\\d+)\\s*分(?:钟)?\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Thinking for $1m $2s',
    },
    {
      regex: '^正在思考\\s*(\\d+)\\s*分(?:钟)?$',
      replacement: 'Thinking for $1m',
    },
    {
      regex: '^正在思考\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Thinking for $1s',
    },
    {
      regex: '^已工作\\s*(\\d+)\\s*天\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?$',
      replacement: 'Worked for $1d $2h $3m',
    },
    {
      regex: '^(?:已运行|已用时)\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Worked for $1h $2m $3s',
    },
    {
      regex: '^(?:已运行|已用时)\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?$',
      replacement: 'Worked for $1h $2m',
    },
    {
      regex: '^(?:已运行|已用时)\\s*(\\d+)\\s*小时$',
      replacement: 'Worked for $1h',
    },
    {
      regex: '^(?:已运行|已用时)\\s*(\\d+)\\s*分(?:钟)?\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Worked for $1m $2s',
    },
    {
      regex: '^(?:已运行|已用时)\\s*(\\d+)\\s*分(?:钟)?$',
      replacement: 'Worked for $1m',
    },
    {
      regex: '^(?:已运行|已用时)\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Worked for $1s',
    },
    {
      regex: '^已运行\\s*(\\d+(?:\\.\\d+)?)\\s*秒$',
      replacement: 'Worked for $1s',
    },
    {
      regex: '^在\\s*(\\d+)\\s*天\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?后停止$',
      replacement: 'Stopped after $1d $2h $3m',
    },
    {
      regex: '^在\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?\\s*(\\d+(?:\\.\\d+)?)\\s*秒后停止$',
      replacement: 'Stopped after $1h $2m $3s',
    },
    {
      regex: '^在\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?后停止$',
      replacement: 'Stopped after $1h $2m',
    },
    {
      regex: '^在\\s*(\\d+)\\s*小时后停止$',
      replacement: 'Stopped after $1h',
    },
    {
      regex: '^在\\s*(\\d+)\\s*分(?:钟)?\\s*(\\d+(?:\\.\\d+)?)\\s*秒后停止$',
      replacement: 'Stopped after $1m $2s',
    },
    {
      regex: '^在\\s*(\\d+)\\s*分(?:钟)?后停止$',
      replacement: 'Stopped after $1m',
    },
    {
      regex: '^在\\s*(\\d+(?:\\.\\d+)?)\\s*秒后停止$',
      replacement: 'Stopped after $1s',
    },
    {
      regex: '^已在\\s*1\\s*步后停止$',
      replacement: 'Stopped after 1 step',
    },
    {
      regex: '^已在\\s*(\\d+)\\s*步后停止$',
      replacement: 'Stopped after $1 steps',
    },
    {
      regex: '^已计时\\s*1\\s*秒$',
      replacement: 'Timed 1 second',
    },
    {
      regex: '^已计时\\s*(\\d+)\\s*秒$',
      replacement: 'Timed $1 seconds',
    },
    {
      regex: '^已计时\\s*1\\s*分(?:钟)?$',
      replacement: 'Timed 1 minute',
    },
    {
      regex: '^已计时\\s*(\\d+)\\s*分(?:钟)?$',
      replacement: 'Timed $1 minutes',
    },

    // 2. Relative timestamps & quota reset/refresh countdowns
    { regex: '^刚刚$', replacement: 'Just now' },
    { regex: '^1\\s*秒前$', replacement: '1 second ago' },
    { regex: '^(\\d+)\\s*秒前$', replacement: '$1 seconds ago' },
    { regex: '^1\\s*分钟前$', replacement: '1 minute ago' },
    { regex: '^(\\d+)\\s*分钟前$', replacement: '$1 minutes ago' },
    { regex: '^1\\s*小时前$', replacement: '1 hour ago' },
    { regex: '^(\\d+)\\s*小时前$', replacement: '$1 hours ago' },
    { regex: '^1\\s*天前$', replacement: '1 day ago' },
    { regex: '^(\\d+)\\s*天前$', replacement: '$1 days ago' },
    { regex: '^1\\s*周前$', replacement: '1 week ago' },
    { regex: '^(\\d+)\\s*周前$', replacement: '$1 weeks ago' },
    { regex: '^1\\s*个月前$', replacement: '1 month ago' },
    { regex: '^(\\d+)\\s*个月前$', replacement: '$1 months ago' },
    { regex: '^1\\s*年前$', replacement: '1 year ago' },
    { regex: '^(\\d+)\\s*年前$', replacement: '$1 years ago' },
    {
      regex: '^(\\d+)\\s*天\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?后重置$',
      replacement: 'Resets in $1d $2h $3m',
    },
    {
      regex: '^(\\d+)\\s*天\\s*(\\d+)\\s*小时后重置$',
      replacement: 'Resets in $1d $2h',
    },
    {
      regex: '^(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?后重置$',
      replacement: 'Resets in $1h $2m',
    },
    {
      regex: '^(\\d+)\\s*分(?:钟)?\\s*(\\d+)\\s*秒后重置$',
      replacement: 'Resets in $1m $2s',
    },
    { regex: '^(\\d+)\\s*天后重置$', replacement: 'Resets in $1d' },
    { regex: '^(\\d+)\\s*小时后重置$', replacement: 'Resets in $1h' },
    { regex: '^(\\d+)\\s*分(?:钟)?后重置$', replacement: 'Resets in $1m' },
    { regex: '^(\\d+)\\s*秒后重置$', replacement: 'Resets in $1s' },
    { regex: '^不到\\s*1\\s*分钟后重置$', replacement: 'Resets in less than a minute' },
    { regex: '^几秒后重置$', replacement: 'Resets in a few seconds' },
    { regex: '^即将重置$', replacement: 'Resets soon' },
    {
      regex: '^建议(?:改用|使用)\\s*(.+?)，(?:效果更好且额度消耗更低|质量更高且配额消耗更低)[。.]\\s*将于\\s+(.+?)\\s+下线[。.]?$',
      replacement: 'Use $1 for better quality with lower quota usage. Leaving on $2.',
    },
    {
      regex: '^建议(?:改用|使用)\\s*(.+?)，(?:效果更好且额度消耗更低|质量更高且配额消耗更低)[。.]?$',
      replacement: 'Use $1 for better quality with lower quota usage.',
    },
    {
      regex: '^适用于高阶工作流的初代\\s+(.+?)\\s+模型[。.]\\s*将于\\s+(.+?)\\s+下线[。.]?$',
      replacement: 'The original $1 model for advanced workflows. Leaving on $2.',
    },
    {
      regex: '^可将常规步骤分流给\\s+(.+?)\\s+的\\s+(.+?)[。.]\\s*保持同等\\s+(.+?)\\s*级质量[，,]\\s*Token 消耗更少[。.]?$',
      replacement: '$2 that may offload routine steps to $1. Same $3-level quality, fewer tokens used.',
    },
    {
      regex: '^(.+?)\\s+将于\\s+(.+?)\\s+从 Antigravity 下线移除[。.]?$',
      replacement: '$1 will be removed from Antigravity on $2.',
    },
    { regex: '^将于\\s+(.+?)\\s+下线[。.]?$', replacement: 'Leaving on $1.' },
    {
      regex: '^(\\d+)\\s*天\\s*(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?后重置刷新$',
      replacement: 'Refreshes in $1d $2h $3m',
    },
    {
      regex: '^(\\d+)\\s*天\\s*(\\d+)\\s*小时后重置刷新$',
      replacement: 'Refreshes in $1d $2h',
    },
    {
      regex: '^(\\d+)\\s*小时\\s*(\\d+)\\s*分(?:钟)?后重置刷新$',
      replacement: 'Refreshes in $1h $2m',
    },
    {
      regex: '^(\\d+)\\s*分(?:钟)?\\s*(\\d+)\\s*秒后重置刷新$',
      replacement: 'Refreshes in $1m $2s',
    },
    { regex: '^(\\d+)\\s*天后重置刷新$', replacement: 'Refreshes in $1d' },
    { regex: '^(\\d+)\\s*小时后重置刷新$', replacement: 'Refreshes in $1h' },
    { regex: '^(\\d+)\\s*分(?:钟)?后重置刷新$', replacement: 'Refreshes in $1m' },
    { regex: '^(\\d+)\\s*秒后重置刷新$', replacement: 'Refreshes in $1s' },
    { regex: '^即将重置刷新$', replacement: 'Refreshes soon' },
    { regex: '^(\\d+)\\s*天\\s*(\\d+)\\s*小时$', replacement: '$1 days, $2 hours' },
    { regex: '^在 Google (?:中)?搜索[“"](.+?)[”"]$', replacement: 'Search Google for "$1"' },
    { regex: '^(\\d+)\\s*小时\\s*(\\d+)\\s*分钟$', replacement: '$1 hours, $2 minutes' },
    { regex: '^1\\s*天$', replacement: '1 day' },
    { regex: '^(\\d+)\\s*天$', replacement: '$1 days' },
    { regex: '^1\\s*小时$', replacement: '1 hour' },
    { regex: '^(\\d+)\\s*小时$', replacement: '$1 hours' },
    { regex: '^1\\s*分钟$', replacement: '1 minute' },
    { regex: '^(\\d+)\\s*分钟$', replacement: '$1 minutes' },

    // 3. File / line / step / item / subagent / conversation / token / git counts
    { regex: '^查看全部\\s*\\((\\d+)\\)$', replacement: 'See all ($1)' },
    { regex: '^查看全部\\s*(\\d+)\\s*项$', replacement: 'See all $1' },
    { regex: '^\\(1\\s*个子智能体\\)$', replacement: '(1 subagent)' },
    { regex: '^\\((\\d+)\\s*个子智能体\\)$', replacement: '($1 subagents)' },
    { regex: '^1\\s*个子智能体$', replacement: '1 subagent' },
    { regex: '^(\\d+)\\s*个子智能体$', replacement: '$1 subagents' },
    { regex: '^1\\s*个运行中的子智能体$', replacement: '1 active subagent' },
    { regex: '^(\\d+)\\s*个运行中的子智能体$', replacement: '$1 active subagents' },
    { regex: '^1\\s*个运行中的任务$', replacement: '1 task running' },
    { regex: '^(\\d+)\\s*个运行中的任务$', replacement: '$1 tasks running' },
    { regex: '^1\\s*个运行中的智能体$', replacement: '1 agent running' },
    { regex: '^(\\d+)\\s*个运行中的智能体$', replacement: '$1 agents running' },
    { regex: '^正在运行任务\\s*(\\d+)$', replacement: 'Task $1 running' },
    { regex: '^1\\s*个文件已修改$', replacement: '1 file changed' },
    { regex: '^(\\d+)\\s*个文件已修改$', replacement: '$1 files changed' },
    { regex: '^1\\s*行新增\\(\\+\\)$', replacement: '1 insertion(+)' },
    { regex: '^(\\d+)\\s*行新增\\(\\+\\)$', replacement: '$1 insertions(+)' },
    { regex: '^1\\s*行删除\\(-\\)$', replacement: '1 deletion(-)' },
    { regex: '^(\\d+)\\s*行删除\\(-\\)$', replacement: '$1 deletions(-)' },
    { regex: '^第\\s*(\\d+)\\s*步[（(]共\\s*(\\d+)\\s*步[）)]$', replacement: 'Step $1 of $2' },
    { regex: '^已创建\\s*1\\s*个文件$', replacement: 'Created 1 file' },
    { regex: '^已创建\\s*(\\d+)\\s*个文件$', replacement: 'Created $1 files' },
    { regex: '^已修改\\s*1\\s*个文件$', replacement: 'Modified 1 file' },
    { regex: '^已修改\\s*(\\d+)\\s*个文件$', replacement: 'Modified $1 files' },
    { regex: '^已浏览探索\\s*1\\s*个文件$', replacement: 'Explored 1 file' },
    { regex: '^已浏览探索\\s*(\\d+)\\s*个文件$', replacement: 'Explored $1 files' },
    { regex: '^已运行\\s*1\\s*个命令$', replacement: 'Ran 1 command' },
    { regex: '^已运行\\s*(\\d+)\\s*个命令$', replacement: 'Ran $1 commands' },
    { regex: '^已查看\\s*1\\s*个任务$', replacement: 'Explored 1 task' },
    { regex: '^已查看\\s*(\\d+)\\s*个任务$', replacement: 'Explored $1 tasks' },
    { regex: '^已于\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s*保存$', replacement: 'Saved at $1' },
    { regex: '^显示\\s*1\\s*项明细$', replacement: 'Show 1 breakdown' },
    { regex: '^显示\\s*(\\d+)\\s*项明细$', replacement: 'Show $1 breakdowns' },
    { regex: '^隐藏\\s*1\\s*项明细$', replacement: 'Hide 1 breakdown' },
    { regex: '^隐藏\\s*(\\d+)\\s*项明细$', replacement: 'Hide $1 breakdowns' },
    { regex: '^1\\s*个活跃会话$', replacement: '1 active conversation' },
    { regex: '^(\\d+)\\s*个活跃会话$', replacement: '$1 active conversations' },
    { regex: '^1\\s*个已归档会话$', replacement: '1 archived conversation' },
    { regex: '^(\\d+)\\s*个已归档会话$', replacement: '$1 archived conversations' },
    { regex: '^将全部\\s*(\\d+)\\s*个会话标记为已读$', replacement: 'Mark all $1 conversations as read' },
    { regex: '^将\\s*1\\s*个会话标记为已读$', replacement: 'Mark 1 conversation as read' },
    { regex: '^将\\s*(\\d+)\\s*个会话标记为已读$', replacement: 'Mark $1 conversations as read' },
    { regex: '^已选择\\s*(\\d+)\\s*个模型$', replacement: '$1 models selected' },
    { regex: '^1\\s*个待推送的提交$', replacement: '1 commit to push' },
    { regex: '^(\\d+)\\s*个待推送的提交$', replacement: '$1 commits to push' },
    { regex: '^1\\s*个待拉取的提交$', replacement: '1 commit to pull' },
    { regex: '^(\\d+)\\s*个待拉取的提交$', replacement: '$1 commits to pull' },
    { regex: '^分支\\s+([a-zA-Z0-9_\\-.\\/]+)$', replacement: 'Branch $1' },
    { regex: '^已启用\\s*1\\s*个工具$', replacement: '1 tool enabled' },
    { regex: '^已启用\\s*(\\d+)\\s*个工具$', replacement: '$1 tools enabled' },
    { regex: '^已禁用\\s*1\\s*个工具$', replacement: '1 tool disabled' },
    { regex: '^已禁用\\s*(\\d+)\\s*个工具$', replacement: '$1 tools disabled' },
    { regex: '^已排除\\s*1\\s*个工具$', replacement: '1 tool excluded' },
    { regex: '^已排除\\s*(\\d+)\\s*个工具$', replacement: '$1 tools excluded' },
    { regex: '^(\\d+)\\s*个工具$', replacement: '$1 tools' },
    { regex: '^(\\d+)\\s*项已降级$', replacement: '$1 demoted' },
    { regex: '^(\\d+)\\s*项已排除$', replacement: '$1 excluded' },
    {
      regex: '^([\\d.]+)%\\s*的自定义扩展预算可用[。.]?$',
      replacement: '$1% of the customization budget is available.',
    },
    {
      regex: '^([\\d,]+)\\s*\\/\\s*([\\d,]+)\\s*个\\s*Token\\s*\\(([\\d.]+%)\\)$',
      replacement: '$1 / $2 tokens ($3)',
    },
    { regex: '^\\(([\\d,]+)\\s*个\\s*Token\\)\\s*([\\d.]+%)$', replacement: '($1 tokens) $2' },
    { regex: '^\\(([\\d,]+)\\s*个\\s*Token\\)$', replacement: '($1 tokens)' },
    { regex: '^未用容量[：:]\\s*([\\d,]+)\\s*个\\s*Token$', replacement: 'Unused capacity: $1 tokens' },
    { regex: '^规则[：:]\\s*([\\d,]+)\\s*个\\s*Token$', replacement: 'Rules: $1 tokens' },
    { regex: '^技能[：:]\\s*([\\d,]+)\\s*个\\s*Token$', replacement: 'Skills: $1 tokens' },
    { regex: '^子智能体[：:]\\s*([\\d,]+)\\s*个\\s*Token$', replacement: 'Subagents: $1 tokens' },
    { regex: '^MCP\\s*工具[：:]\\s*([\\d,]+)\\s*个\\s*Token$', replacement: 'MCP Tools: $1 tokens' },
    { regex: '^MCP\\s*服务[：:]\\s*([\\d,]+)\\s*个\\s*Token$', replacement: 'MCP Servers: $1 tokens' },
    { regex: '^系统提示词[：:]\\s*([\\d,]+)\\s*个\\s*Token$', replacement: 'System Prompt: $1 tokens' },
    { regex: '^自定义扩展[：:]\\s*([\\d,]+)\\s*个\\s*Token$', replacement: 'Customizations: $1 tokens' },
    { regex: '^其他自定义扩展[：:]\\s*([\\d,]+)\\s*个\\s*Token$', replacement: 'Other Customizations: $1 tokens' },
    { regex: '^选择模型，当前[：:]\\s*(.+)$', replacement: 'Select model, current: $1' },
    {
      regex: '^智能体权限预设选择器，当前[：:]\\s*(.+)$',
      replacement: 'Agent permissions preset selector, current: $1',
    },
    { regex: '^当前方案[：:]\\s*(.+)$', replacement: 'Your Plan: $1' },
    { regex: '^共享模型[：:]\\s*(.+)$', replacement: 'Shared with: $1' },
    { regex: '^可用\\s*AI\\s*积分[：:]\\s*(.+)$', replacement: 'Available AI Credits: $1' },
    {
      regex: '^发送消息\\s+(Enter|Return|Ctrl\\+Enter|Cmd\\+Enter|↵)$',
      replacement: 'Send message $1',
    },
    {
      regex: '^发送消息\\s+\\((Enter|Return|Ctrl\\+Enter|Cmd\\+Enter|↵)\\)$',
      replacement: 'Send message ($1)',
    },
    {
      regex: '^取消\\s*\\(((?:Ctrl|Cmd|Alt|Shift)\\+[\\w+\\-]+)\\)$',
      replacement: 'Cancel ($1)',
    },
    {
      regex: '^(Enter|Alt\\+Enter|Shift\\+Enter|Ctrl\\+Enter|Cmd\\+Enter)\\s+轮次结束后进入排队$',
      replacement: '$1 Queues after the turn',
    },
    {
      regex: '^(Enter|Alt\\+Enter|Shift\\+Enter|Ctrl\\+Enter|Cmd\\+Enter)\\s+立即发送$',
      replacement: '$1 Sends immediately',
    },
    {
      regex: '^(Enter|Alt\\+Enter|Shift\\+Enter|Ctrl\\+Enter|Cmd\\+Enter)\\s+在输入框为空时发送队列中的下一条消息$',
      replacement: '$1 On empty prompt, sends next in queue',
    },
    { regex: '^所有定时任务均以\\s+(.+?)\\s*模型运行[。.]?$', replacement: 'All scheduled tasks run as $1.' },
    { regex: '^所有插件均以\\s+(.+?)\\s*模型运行[。.]?$', replacement: 'All plugins run as $1.' },
    { regex: '^所有自动化任务均以\\s+(.+?)\\s*模型运行[。.]?$', replacement: 'All automations run as $1.' },
    { regex: '^未命名智能体\\s+(\\d+)$', replacement: 'Unnamed agent $1' },
    { regex: '^未命名技能\\s+(\\d+)$', replacement: 'Unnamed skill $1' },
    { regex: '^界面扩展\\s+(\\d+)$', replacement: 'UI Extension $1' },
    { regex: '^自动化任务\\s+(\\d+)$', replacement: 'Automation $1' },
    { regex: '^规则\\s+(\\d+)$', replacement: 'Rule $1' },

    // 4. Chinese dates & AM/PM timestamps (two-stage fully ^...$ anchored conversion)
    {
      regex: '^(\\d{4})\\s*年\\s*(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日\\s*(上午|下午)\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)$',
      replacement: '$2月 $3, $1, $5 $4',
    },
    {
      regex: '^(\\d{4})\\s*年\\s*(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s*(上午|下午)$',
      replacement: '$2月 $3, $1, $4 $5',
    },
    {
      regex: '^(\\d{4})\\s*年\\s*(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?)$',
      replacement: '$2月 $3, $1, $4',
    },
    {
      regex: '^(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日\\s*(上午|下午)\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)$',
      replacement: '$1月 $2, $4 $3',
    },
    {
      regex: '^(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s*(上午|下午)$',
      replacement: '$1月 $2, $3 $4',
    },
    {
      regex: '^(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?)$',
      replacement: '$1月 $2, $3',
    },
    {
      regex: '^(\\d{4})\\s*年\\s*(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日$',
      replacement: '$2月 $3, $1',
    },
    {
      regex: '^(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日\\s*[-–—]\\s*(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日$',
      replacement: '$1月 $2 - $3月 $4',
    },
    {
      regex: '^(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日\\s*[-–—]\\s*(\\d{1,2})\\s*日$',
      replacement: '$1月 $2 - $3',
    },
    {
      regex: '^(1[0-2]|[1-9])\\s*月\\s*(\\d{1,2})\\s*日$',
      replacement: '$1月 $2',
    },
    {
      regex: '^(上午|下午)\\s*(\\d{1,2}:\\d{2}(?::\\d{2})?)$',
      replacement: '$2 $1',
    },
    {
      regex: '^(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s*(上午|下午)$',
      replacement: '$1 $2',
    },
    {
      regex: '^((?:1[0-2]|[1-9])月 \\d{1,2}(?:, \\d{4})?, \\d{1,2}:\\d{2}(?::\\d{2})?) 上午$',
      replacement: '$1 AM',
    },
    {
      regex: '^((?:1[0-2]|[1-9])月 \\d{1,2}(?:, \\d{4})?, \\d{1,2}:\\d{2}(?::\\d{2})?) 下午$',
      replacement: '$1 PM',
    },
    { regex: '^(\\d{1,2}:\\d{2}(?::\\d{2})?) 上午$', replacement: '$1 AM' },
    { regex: '^(\\d{1,2}:\\d{2}(?::\\d{2})?) 下午$', replacement: '$1 PM' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )1月 (\\d{1,2})$', replacement: '$1Jan $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )2月 (\\d{1,2})$', replacement: '$1Feb $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )3月 (\\d{1,2})$', replacement: '$1Mar $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )4月 (\\d{1,2})$', replacement: '$1Apr $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )5月 (\\d{1,2})$', replacement: '$1May $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )6月 (\\d{1,2})$', replacement: '$1Jun $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )7月 (\\d{1,2})$', replacement: '$1Jul $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )8月 (\\d{1,2})$', replacement: '$1Aug $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )9月 (\\d{1,2})$', replacement: '$1Sep $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )10月 (\\d{1,2})$', replacement: '$1Oct $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )11月 (\\d{1,2})$', replacement: '$1Nov $2' },
    { regex: '^((?:1[0-2]|[1-9])月 \\d{1,2} - )12月 (\\d{1,2})$', replacement: '$1Dec $2' },
    {
      regex: '^1月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Jan $1',
    },
    {
      regex: '^2月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Feb $1',
    },
    {
      regex: '^3月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Mar $1',
    },
    {
      regex: '^4月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Apr $1',
    },
    {
      regex: '^5月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'May $1',
    },
    {
      regex: '^6月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Jun $1',
    },
    {
      regex: '^7月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Jul $1',
    },
    {
      regex: '^8月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Aug $1',
    },
    {
      regex: '^9月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Sep $1',
    },
    {
      regex: '^10月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Oct $1',
    },
    {
      regex: '^11月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Nov $1',
    },
    {
      regex: '^12月 (\\d{1,2}(?:, \\d{4})?(?:, \\d{1,2}:\\d{2}(?::\\d{2})?(?: (?:AM|PM))?)?(?: - (?:[A-Z][a-z]{2} )?\\d{1,2})?)$',
      replacement: 'Dec $1',
    },
  ];

  /**
   * Declarative cross-TextNode reverse restoration rules mirroring the forward cross-node
   * transformations in host-i18n-runtime.js:
   *   1. plan-command-fyi-alert: "输入 " + <code>/plan</code> -> "Type " + <code>/plan</code>
   *   2. also-includes-when-working: "在此项目中工作时，也包含" + <el> + "。" -> "Also includes " + <el> + " when working in this project."
   *   3. trailing-zh-period-after-en: <English sibling> + "。" -> <English sibling> + "."
   */
  var REVERSE_CROSS_NODE_RULES = [
    {
      id: 'plan-command-fyi-alert-type',
      kind: 'testid-span-prefix',
      testid: 'plan-command-fyi-alert',
      matchTrimmed: ['输入'],
      replacement: 'Type',
    },
    {
      id: 'also-includes-when-working',
      kind: 'element-sandwich',
      leadTrimmed: ['在此项目中工作时，也包含', '在此项目中工作时也包含', '也包含'],
      tailTrimmed: ['。', '.', '在此项目中工作时。', '在此项目中工作时', '（在此项目中工作时）。', '（在此项目中工作时）'],
      leadReplacement: 'Also includes ',
      tailReplacement: ' when working in this project.',
    },
    {
      id: 'trailing-zh-period-after-en',
      kind: 'trailing-period-after-ascii',
      matchTrimmed: '。',
      replacement: '.',
    },
  ];

  var SUP_MODEL_PANEL_LOCALE = {
    zh: {
      exact: {
        'Leaving Soon': '即将下线',
        Notice: '提示',
        'Claude and GPT Models': 'Claude 与 GPT 模型',
        'Gemini models': 'Gemini 模型',
        'Resets in < 1m': '不到 1 分钟后重置',
        'Resets in < 1m.': '不到 1 分钟后重置。',
        'Offloads routine steps to a faster executor. Same quality, fewer tokens used.': '将常规步骤分流给更快的执行器。质量不变，Token 消耗更少。',
        'Offloads routine steps to a faster executor. Same quality, fewer tokens used': '将常规步骤分流给更快的执行器。质量不变，Token 消耗更少',
        'For most deep reasoning and complex problems': '适合大多数深度推理与复杂问题',
        'For most deep reasoning and complex problems.': '适合大多数深度推理与复杂问题。',
        'For your hardest, long-horizon tasks': '适合最具挑战性的长周期任务',
        'For your hardest, long-horizon tasks.': '适合最具挑战性的长周期任务。',
        'For speed and efficiency in execution tasks': '兼顾执行任务的速度与效率',
        'For speed and efficiency in execution tasks.': '兼顾执行任务的速度与效率。',
        Web: '网页',
      },
      patterns: [
        { regex: '^Use (.+?) for better quality with lower quota usage\\.\\s*Leaving on (.+?)[。.]?$', replacement: '建议改用 $1，效果更好且额度消耗更低。将于 $2 下线。' },
        { regex: '^Use (.+?) for better quality with lower quota usage[。.]?$', replacement: '建议改用 $1，效果更好且额度消耗更低。' },
        { regex: '^The original (.+?) model for advanced workflows\\.\\s*Leaving on (.+?)[。.]?$', replacement: '适用于高阶工作流的初代 $1 模型。将于 $2 下线。' },
        { regex: '^(.+?) that may offload routine steps to (.+?)\\.\\s*Same (.+?)-level quality,\\s*fewer tokens used[。.]?$', replacement: '可将常规步骤分流给 $2 的 $1。保持同等 $3 级质量，Token 消耗更少。' },
        { regex: '^(.+?) will be removed from Antigravity on (.+?)[。.]?$', replacement: '$1 将于 $2 从 Antigravity 下线移除。' },
        { regex: '^Leaving on (.+?)[。.]?$', replacement: '将于 $1 下线。' },
        { regex: '^Search Google for "(.+?)"$', replacement: '在 Google 中搜索“$1”' },
      ],
    },
    tr: {
      exact: {
        'Leaving Soon': 'Yakında Kaldırılacak',
        Notice: 'Bildirim',
        'Claude and GPT Models': 'Claude ve GPT modelleri',
        'Gemini models': 'Gemini modelleri',
        'Resets in < 1m': '< 1 dk içinde sıfırlanır',
        'Resets in < 1m.': '< 1 dk içinde sıfırlanır.',
        'Offloads routine steps to a faster executor. Same quality, fewer tokens used.': 'Rutin adımları daha hızlı bir yürütücüye aktarır. Aynı kalite, daha az token.',
        'Offloads routine steps to a faster executor. Same quality, fewer tokens used': 'Rutin adımları daha hızlı bir yürütücüye aktarır. Aynı kalite, daha az token',
        'For most deep reasoning and complex problems': 'Çoğu derin akıl yürütme ve karmaşık sorun için',
        'For most deep reasoning and complex problems.': 'Çoğu derin akıl yürütme ve karmaşık sorun için.',
        'For your hardest, long-horizon tasks': 'En zorlu ve uzun vadeli görevleriniz için',
        'For your hardest, long-horizon tasks.': 'En zorlu ve uzun vadeli görevleriniz için.',
        'For speed and efficiency in execution tasks': 'Yürütme görevlerinde hız ve verimlilik için',
        'For speed and efficiency in execution tasks.': 'Yürütme görevlerinde hız ve verimlilik için.',
        Web: 'Web',
      },
      patterns: [
        { regex: '^Use (.+?) for better quality with lower quota usage\\.\\s*Leaving on (.+?)[。.]?$', replacement: 'Daha düşük kota kullanımıyla daha iyi kalite için $1 kullanın. $2 tarihinde kaldırılacak.' },
        { regex: '^Use (.+?) for better quality with lower quota usage[。.]?$', replacement: 'Daha düşük kota kullanımıyla daha iyi kalite için $1 kullanın.' },
        { regex: '^The original (.+?) model for advanced workflows\\.\\s*Leaving on (.+?)[。.]?$', replacement: 'Gelişmiş iş akışları için özgün $1 modeli. $2 tarihinde kaldırılacak.' },
        { regex: '^(.+?) that may offload routine steps to (.+?)\\.\\s*Same (.+?)-level quality,\\s*fewer tokens used[。.]?$', replacement: 'Rutin adımları $2 modeline aktarabilen $1. Aynı $3 seviyesinde kalite, daha az token.' },
        { regex: '^(.+?) will be removed from Antigravity on (.+?)[。.]?$', replacement: '$1, $2 tarihinde Antigravity\'den kaldırılacak.' },
        { regex: '^Leaving on (.+?)[。.]?$', replacement: '$1 tarihinde kaldırılacak.' },
        { regex: '^Search Google for "(.+?)"$', replacement: 'Google\'da "$1" ara' },
      ],
    },
  };

  function detectSupLocale(exactDict) {
    var wl = exactDict && exactDict['Weekly limit'];
    if (wl === '周限额') return 'zh';
    if (wl === 'Haftalık sınır') return 'tr';
    return null;
  }

  var MODEL_PANEL_RULES = {
    scopedTestids: {
      'model-selector-panel': 1,
      'model-selector-list': 1,
      'model-selector-item': 1,
      'model-selector-orchestrator': 1,
      'orchestrator-picker-row': 1,
    },
    safeExact: {
      Model: 1, 模型: 1, New: 1, 新: 1, 新建: 1, Yeni: 1, 'Leaving Soon': 1, 即将下线: 1, 'Yakında Kaldırılacak': 1,
      Notice: 1, 提示: 1, Bildirim: 1,
      'View Usage': 1, 'View usage': 1, 'View Model Usage': 1, 'View Usage Details': 1,
      查看用量明细: 1, 查看模型用量: 1, 查看用量详情: 1, 查看用量: 1, 'Kullanımı görüntüle': 1,
      Usage: 1, 'Usage & Quota': 1, 用量: 1, 用量与配额: 1, Kullanım: 1,
      'Gemini Models': 1, 'Gemini models': 1, 'Gemini 模型': 1, 'Gemini modelleri': 1,
      'Claude and GPT models': 1, 'Claude and GPT Models': 1, 'Claude 与 GPT 模型': 1, 'Claude ve GPT modelleri': 1,
      'Weekly limit': 1, 'Weekly Limit': 1, 周限额: 1, 'Haftalık sınır': 1,
      'Loading token usage...': 1, '正在加载 Token 用量...': 1,
      'Offloads routine steps to a faster executor. Same quality, fewer tokens used.': 1,
      '将常规步骤分流给更快的执行器。质量不变，Token 消耗更少。': 1,
      'Rutin adımları daha hızlı bir yürütücüye aktarır. Aynı kalite, daha az token.': 1,
      'For most deep reasoning and complex problems': 1, 适合大多数深度推理与复杂问题: 1,
      'Çoğu derin akıl yürütme ve karmaşık sorun için': 1,
      'For your hardest, long-horizon tasks': 1, 适合最具挑战性的长周期任务: 1,
      'En zorlu ve uzun vadeli görevleriniz için': 1,
      'For speed and efficiency in execution tasks': 1, 兼顾执行任务的速度与效率: 1,
      'Yürütme görevlerinde hız ve verimlilik için': 1,
    },
    safeRe: /^(?:\d+\s*[hdms]\s+(?:rate\s+)?limit|\d+(?:\.\d+)?%\s+left|resets?\b|use\s+.+?\s+for\s+better\s+quality\s+with\s+lower\s+quota\s+usage|the\s+original\s+.+?\s+model\s+for\s+advanced\s+workflows|.+?\s+that\s+may\s+offload\s+routine\s+steps\s+to\s+.+?|.+\s+will\s+be\s+removed\s+from\s+antigravity\s+on\s+.+?|leaving\s+on\b|models\s+within\s+this\s+group|your\s+quota\s+for\s+this\s+model|\d+\s*(?:小时|天|分钟|秒)(?:速率限(?:制|额)|限额)|剩余\s*\d+(?:\.\d+)?%|(?:\d+\s*(?:天|小时|分(?:钟)?|秒)\s*)+后重置|不到\s*1\s*分钟后重置|几秒后重置|即将重置|重置于|建议(?:改用|使用)\s*.+?，(?:效果更好|质量更高)|适用于高阶工作流的初代\s+.+?\s+模型|可将常规步骤分流给\s+.+?|.+?\s+将于\s+.+?\s+从\s+Antigravity\s+下线移除|将于\s+.+?\s+下线|\d+\s*(?:sa|gün|dk|sn)(?:\s+hız\s+sınırı|\s+limit)?|%\d+(?:\.\d+)?\s+kaldı|<?\s*1\s*dk\s+içinde\s+sıfırlanır|.+?\s+(?:içinde|sonra)\s+sıfırlanır|yakında\s+sıfırlanır|daha\s+düşük\s+kota\s+kullanımıyla\s+daha\s+iyi\s+kalite\s+için\s+.+?|gelişmiş\s+iş\s+akışları\s+için\s+özgün\s+.+?|rutin\s+adımları\s+.+?\s+modeline\s+aktarabilen\s+.+?|.+\s+tarihinde\s+(?:antigravity'den\s+)?kaldırılacak)/i,
    fwdZh: { New: '新' },
    revZh: { 新: 'New' },
    supExactByLocale: { zh: SUP_MODEL_PANEL_LOCALE.zh.exact, tr: SUP_MODEL_PANEL_LOCALE.tr.exact },
    supPatternsByLocale: { zh: SUP_MODEL_PANEL_LOCALE.zh.patterns, tr: SUP_MODEL_PANEL_LOCALE.tr.patterns },
    supExact: SUP_MODEL_PANEL_LOCALE.zh.exact,
    supPatterns: SUP_MODEL_PANEL_LOCALE.zh.patterns,
    isSafeText: function (trimmed) {
      return Boolean(trimmed && (Object.prototype.hasOwnProperty.call(MODEL_PANEL_RULES.safeExact, trimmed) || MODEL_PANEL_RULES.safeRe.test(trimmed)));
    },
    isScopedTid: function (tid) {
      return Boolean(tid && Object.prototype.hasOwnProperty.call(MODEL_PANEL_RULES.scopedTestids, tid));
    },
    mergeSupPatterns: function (exactDict, rawPatterns) {
      var loc = detectSupLocale(exactDict);
      return loc ? rawPatterns.concat(SUP_MODEL_PANEL_LOCALE[loc].patterns) : rawPatterns;
    },
    mergeSupExact: function (exactDict, exactLookup, translatedValues) {
      var loc = detectSupLocale(exactDict);
      if (!loc) return;
      var s = SUP_MODEL_PANEL_LOCALE[loc].exact;
      for (var k in s) {
        if (Object.prototype.hasOwnProperty.call(s, k) && !(k in exactLookup)) {
          exactLookup[k] = s[k];
          translatedValues[s[k]] = true;
        }
      }
    },
    resolveUnit: function (trimmed, isScoped, isOff, eng, fallbackFn) {
      if (isScoped) {
        if (isOff && Object.prototype.hasOwnProperty.call(MODEL_PANEL_RULES.revZh, trimmed)) return MODEL_PANEL_RULES.revZh[trimmed];
        if (!isOff && eng && detectSupLocale(eng.exactDict) === 'zh' && Object.prototype.hasOwnProperty.call(MODEL_PANEL_RULES.fwdZh, trimmed)) {
          return MODEL_PANEL_RULES.fwdZh[trimmed];
        }
      }
      return fallbackFn(trimmed);
    },
    queueNode: function (list, n) {
      if (n && n.nodeType === 1 && list.indexOf(n) === -1 && list.length < 16) list.push(n);
    },
  };

  return {
    REVERSE_EXACT_OVERRIDES: REVERSE_EXACT_OVERRIDES,
    REVERSE_PATTERNS: REVERSE_PATTERNS,
    REVERSE_CROSS_NODE_RULES: REVERSE_CROSS_NODE_RULES,
    MODEL_PANEL_RULES: MODEL_PANEL_RULES,
  };
});
