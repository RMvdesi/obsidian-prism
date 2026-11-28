// Channel 18 独立 9 语种词典（全局 3 级字体下拉选择器 + custom.css 注入）
// 严格遵循 9 语种规范：zh-CN / zh-TW / en / ja / ko / es / fr / de / tr；非 CJK 语种 0 汉字、0 yue、0 禁用词
(function (root, factory) {
  const api = factory();
  if (root) root.__agPrismCustomStyleI18n = api;
  if (typeof window !== 'undefined' && window && window !== root) {
    window.__agPrismCustomStyleI18n = api;
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';

  const LOCALES = Object.freeze(['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'tr']);
  const LOCALE_INDEX = Object.freeze(Object.fromEntries(LOCALES.map((l, i) => [l, i])));

  const TABLE = Object.freeze({
    setUiFontTitle: [
      '全局界面字体',
      '全域介面字型',
      'Global UI Font',
      '全体 UI フォント',
      '전체 UI 글꼴',
      'Fuente global de interfaz',
      'Police globale de l’interface',
      'Globale UI-Schriftart',
      'Genel Arayüz Yazı Tipi',
    ],
    setUiFontDesc: [
      '统一修改宿主全局界面字体（侧栏、弹窗、菜单与按钮），自动保护图标字体与代码块；正文为「宿主默认」时自动继承此字体。',
      '統一修改宿主全域介面字型（側欄、彈窗、選單與按鈕），自動保護圖示字型與程式碼區塊；正文為「宿主預設」時自動繼承此字型。',
      'Applies across host UI chrome (sidebars, dialogs, menus, buttons) while protecting icon fonts and monospace code. Chat body inherits this when set to Host Default.',
      'サイドバー・ダイアログ・メニュー等の全体 UI フォントを変更します（アイコンとコードは保護）。チャット本文が既定の時は自動継承します。',
      '사이드바, 대화상자, 메뉴 등 전체 UI 글꼴을 변경합니다(아이콘 및 코드 보호). 채팅 본문이 기본값이면 이 글꼴을 자동 상속합니다.',
      'Cambia la fuente de toda la interfaz (barras, diálogos, menús) protegiendo iconos y código. El texto del chat la hereda si está en Predeterminada.',
      'Applique la police à toute l’interface (barres, dialogues, menus) tout en protégeant icônes et code. Le texte du chat en hérite par défaut.',
      'Passt die Schriftart der gesamten Oberfläche an und schützt Symbole sowie Codeblöcke. Der Chat-Text erbt sie bei Standardeinstellung automatisch.',
      'Simge yazı tiplerini ve kod bloklarını koruyarak tüm arayüz yazı tipini değiştirir. Sohbet metni varsayılan ayardayken bunu devralır.',
    ],
    uiFontCustomPlaceholder: [
      '输入全局 UI 字体名，逗号分隔（如 Inter, MiSans, PingFang SC）',
      '輸入全域 UI 字型名，逗號分隔（如 Inter, PingFang TC）',
      'UI font families, comma-separated (e.g. Inter, Segoe UI)',
      'UI フォント名を入力（カンマ区切り、例: Inter, BIZ UDPGothic）',
      'UI 글꼴 이름 입력, 쉼표 구분 (예: Pretendard, Inter)',
      'Fuentes de interfaz separadas por comas (ej. Inter, Segoe UI)',
      'Polices d’interface séparées par des virgules (ex. Inter, Segoe UI)',
      'UI-Schriftarten, kommagetrennt (z. B. Inter, Segoe UI)',
      'Virgülle ayrılmış arayüz yazı tipleri (örn. Inter, Segoe UI)',
    ],
    setCustomCssTitle: [
      '自定义 CSS (custom.css)',
      '自訂 CSS (custom.css)',
      'Custom CSS (custom.css)',
      'カスタム CSS (custom.css)',
      '사용자 지정 CSS (custom.css)',
      'CSS personalizado (custom.css)',
      'CSS personnalisé (custom.css)',
      'Benutzerdefiniertes CSS (custom.css)',
      'Özel CSS (custom.css)',
    ],
    setCustomCssDesc: [
      '加载插件目录中的本地 custom.css（最高优先级，保存文件后自动热重载，升级保留；上限 256 KB，自动拦截外部 @import）。',
      '載入外掛目錄中的本機 custom.css（最高優先級，儲存檔案後自動熱重載，升級保留；上限 256 KB，自動攔截外部 @import）。',
      'Loads local custom.css from the plugin folder with highest cascade priority. Saving the file automatically hot-reloads changes (upgrade-safe, <= 256 KB, @import blocked).',
      'プラグイン内のローカル custom.css を最優先で読み込みます。ファイルを保存すると自動でホットリロードされます（更新保護・上限 256 KB・@import 遮断）。',
      '플러그인 폴더의 로컬 custom.css를 최우선으로 적용합니다. 파일을 저장하면 자동으로 즉시 반영됩니다(업데이트 보존, 최대 256 KB, @import 차단).',
      'Carga el archivo local custom.css con máxima prioridad. Al guardar el archivo se recarga automáticamente en caliente (conservado al actualizar, <= 256 KB, sin @import).',
      'Charge le fichier local custom.css avec priorité maximale. L’enregistrement recharge automatiquement les changements à chaud (préservé aux mises à jour, <= 256 Ko, @import bloqué).',
      'Lädt die lokale custom.css mit höchster Priorität. Beim Speichern werden Änderungen automatisch per Hot-Reload übernommen (update-sicher, <= 256 KB, @import blockiert).',
      'Eklenti klasöründeki yerel custom.css dosyasını en yüksek öncelikle yükler. Dosyayı kaydettiğinizde değişiklikler otomatik olarak anında yenilenir (güncellemede korunur, <= 256 KB, @import engelli).',
    ],
    btnCreateCustomCss: [
      '创建模板',
      '建立範本',
      'Create Template',
      'テンプレート作成',
      '템플릿 생성',
      'Crear plantilla',
      'Créer un modèle',
      'Vorlage erstellen',
      'Şablon Oluştur',
    ],
    btnOpenCustomCss: [
      '打开',
      '開啟',
      'Open',
      '開く',
      '열기',
      'Abrir',
      'Ouvrir',
      'Öffnen',
      'Aç',
    ],
    cssOpenTooltip: [
      '用系统默认编辑器打开 custom.css（保存后自动热重载）',
      '用系統預設編輯器開啟 custom.css（儲存後自動熱重載）',
      'Open custom.css in your default editor (saves auto hot-reload)',
      '既定のエディタで custom.css を開く（保存時に自動反映）',
      '기본 편집기에서 custom.css 열기 (저장 시 자동 반영)',
      'Abrir custom.css en el editor predeterminado (recarga automática al guardar)',
      'Ouvrir custom.css dans l’éditeur par défaut (rechargement automatique)',
      'custom.css im Standardeditor öffnen (Hot-Reload beim Speichern)',
      'custom.css dosyasını varsayılan düzenleyicide aç (kaydetmede otomatik yenilenir)',
    ],
    cssOpenBlockedSymlink: [
      '安全拦截：custom.css 为符号链接或非普通文件，已禁止直接打开，请在插件目录中检查',
      '安全攔截：custom.css 為符號連結或非一般檔案，已禁止直接開啟，請在外掛目錄中檢查',
      'Blocked for security: custom.css is a symlink or non-regular file and cannot be opened; inspect it in the plugin folder',
      '安全のためブロック：custom.css がシンボリックリンクまたは通常ファイルではないため開けません。プラグインフォルダを確認してください',
      '보안상 차단됨: custom.css가 심볼릭 링크이거나 일반 파일이 아니므로 열 수 없습니다. 플러그인 폴더에서 확인하세요',
      'Bloqueado por seguridad: custom.css es un enlace simbólico o no es un archivo regular; revísalo en la carpeta del complemento',
      'Bloqué par sécurité : custom.css est un lien symbolique ou un élément non valide ; vérifiez le dossier du module',
      'Aus Sicherheitsgründen blockiert: custom.css ist ein Symlink oder keine reguläre Datei; bitte im Plugin-Ordner prüfen',
      'Güvenlik nedeniyle engellendi: custom.css bir sembolik bağlantı veya normal dosya değil; eklenti klasöründe inceleyin',
    ],
    cssOpenBlockedTooLarge: [
      '安全拦截：custom.css 超过 256 KB 上限，已禁止直接打开，请在插件目录中手动检查',
      '安全攔截：custom.css 超過 256 KB 上限，已禁止直接開啟，請在外掛目錄中手動檢查',
      'Blocked for security: custom.css exceeds the 256 KB limit and cannot be opened; inspect it in the plugin folder',
      '安全のためブロック：custom.css が 256 KB 上限を超えているため開けません。プラグインフォルダで確認してください',
      '보안상 차단됨: custom.css가 256 KB 제한을 초과하여 열 수 없습니다. 플러그인 폴더에서 확인하세요',
      'Bloqueado por seguridad: custom.css supera el límite de 256 KB; revísalo en la carpeta del complemento',
      'Bloqué par sécurité : custom.css dépasse la limite de 256 Ko ; vérifiez le dossier du module',
      'Aus Sicherheitsgründen blockiert: custom.css überschreitet das 256-KB-Limit; bitte im Plugin-Ordner prüfen',
      'Güvenlik nedeniyle engellendi: custom.css 256 KB sınırını aşıyor; eklenti klasöründe inceleyin',
    ],
    cssOpenBlockedError: [
      '无法安全验证 custom.css（请检查插件目录权限），已禁止打开',
      '無法安全驗證 custom.css（請檢查外掛目錄權限），已禁止開啟',
      'Opening blocked: unable to verify custom.css safely (check permissions in the plugin folder)',
      '安全確認に失敗したため開けません（プラグインフォルダの権限を確認してください）',
      '보안 확인 실패로 열 수 없습니다 (플러그인 폴더 권한을 확인하세요)',
      'Apertura bloqueada: no se pudo verificar custom.css de forma segura (revisa los permisos)',
      'Ouverture bloquée : impossible de vérifier custom.css en toute sécurité (vérifiez les droits)',
      'Öffnen blockiert: custom.css konnte nicht sicher geprüft werden (Rechte im Plugin-Ordner prüfen)',
      'Açma engellendi: custom.css güvenli biçimde doğrulanamadı (eklenti klasörü izinlerini kontrol edin)',
    ],
    cssStatusActive: [
      '已生效 ({kb} KB)',
      '已生效 ({kb} KB)',
      'Active ({kb} KB)',
      '適用中 ({kb} KB)',
      '적용됨 ({kb} KB)',
      'Activo ({kb} KB)',
      'Actif ({kb} Ko)',
      'Aktiv ({kb} KB)',
      'Etkin ({kb} KB)',
    ],
    cssStatusMissing: [
      '未检测到 custom.css（零开销待命）',
      '未偵測到 custom.css（零開銷待命）',
      'No custom.css found (0 overhead)',
      'custom.css 未検出（ゼロ負荷待機）',
      'custom.css 없음 (오버헤드 0)',
      'No se encontró custom.css (sin carga)',
      'Aucun custom.css détecté (0 surcharge)',
      'Keine custom.css gefunden (0 Aufwand)',
      'custom.css bulunamadı (0 yük)',
    ],
    cssStatusEmpty: [
      'custom.css 当前为空或仅含注释（保存后自动热重载）',
      'custom.css 目前為空或僅含註解（儲存後自動熱重載）',
      'custom.css is currently empty (saves auto hot-reload)',
      'custom.css は空です（保存時に自動反映）',
      'custom.css 파일이 비어 있습니다 (저장 시 자동 반영)',
      'custom.css está vacío (se recarga automáticamente al guardar)',
      'custom.css est vide (rechargement automatique à l’enregistrement)',
      'custom.css ist leer (Hot-Reload beim Speichern)',
      'custom.css şu anda boş (kaydetmede otomatik yenilenir)',
    ],
    cssStatusDisabled: [
      '已关闭（本地文件保留不受影响）',
      '已關閉（本機檔案保留不受影響）',
      'Disabled (local file preserved)',
      '無効（ローカルファイルは保持）',
      '비활성화됨 (로컬 파일 보존)',
      'Desactivado (archivo local conservado)',
      'Désactivé (fichier local conservé)',
      'Deaktiviert (lokale Datei bleibt erhalten)',
      'Devre dışı (yerel dosya korunur)',
    ],
    cssStatusTooLarge: [
      '已拒绝：超过 256 KB 安全上限（已禁止打开，请在插件目录处理）',
      '已拒絕：超過 256 KB 安全上限（已禁止開啟，請在外掛目錄處理）',
      'Rejected: exceeds 256 KB safety limit (opening blocked; inspect in plugin folder)',
      '拒否：256 KB の安全上限を超過（安全のため開けません）',
      '거부됨: 256 KB 안전 제한 초과 (보안상 열기 차단됨)',
      'Rechazado: supera 256 KB (apertura bloqueada por seguridad)',
      'Refusé : dépasse 256 Ko (ouverture bloquée par sécurité)',
      'Abgelehnt: > 256 KB Limit (Öffnen aus Sicherheitsgründen blockiert)',
      'Reddedildi: 256 KB sınırını aşıyor (güvenlik için açma engellendi)',
    ],
    cssStatusSymlink: [
      '已拒绝：不允许符号链接或非普通文件（已禁止打开，请在插件目录检查）',
      '已拒絕：不允許符號連結或非一般檔案（已禁止開啟，請在外掛目錄檢查）',
      'Rejected: symlinks and non-regular files are not allowed (opening blocked)',
      '拒否：シンボリックリンク等は不可（安全のため開けません）',
      '거부됨: 심볼릭 링크 또는 비일반 파일 불가 (보안상 열기 차단됨)',
      'Rechazado: enlaces simbólicos no permitidos (apertura bloqueada)',
      'Refusé : liens symboliques interdits (ouverture bloquée)',
      'Abgelehnt: Symlinks nicht zulässig (Öffnen blockiert)',
      'Reddedildi: sembolik bağlantılara izin verilmez (açma engellendi)',
    ],
    cssStatusError: [
      '读取 custom.css 失败（请检查文件权限）',
      '讀取 custom.css 失敗（請檢查檔案權限）',
      'Failed to read custom.css (check permissions)',
      'custom.css の読み込みに失敗しました',
      'custom.css를 읽지 못했습니다 (권한 확인)',
      'Error al leer custom.css (revisa los permisos)',
      'Impossible de lire custom.css (vérifiez les droits)',
      'Fehler beim Lesen von custom.css (Rechte prüfen)',
      'custom.css okunamadı (izinleri kontrol edin)',
    ],
    cssBlockedImports: [
      '已安全拦截 {n} 条 @import 规则',
      '已安全攔截 {n} 條 @import 規則',
      'Blocked {n} @import rule(s) for safety',
      '安全のため @import を {n} 件ブロックしました',
      '안전을 위해 @import 규칙 {n}건을 차단했습니다',
      'Se bloquearon {n} reglas @import por seguridad',
      '{n} règle(s) @import bloquée(s) par sécurité',
      '{n} @import-Regel(n) aus Sicherheitsgründen blockiert',
      'Güvenlik için {n} @import kuralı engellendi',
    ],
    cssTemplateRequested: [
      '已创建并正在打开 custom.css，保存后自动热重载',
      '已建立並正在開啟 custom.css，儲存後自動熱重載',
      'Created and opening custom.css; saves auto hot-reload',
      'custom.css を作成して開いています（保存時に自動反映）',
      'custom.css를 생성하고 여는 중입니다 (저장 시 자동 반영)',
      'Plantilla creada y abriendo custom.css; se recargará al guardar',
      'Modèle créé et ouverture de custom.css ; rechargement auto à l’enregistrement',
      'Vorlage erstellt und custom.css wird geöffnet; Hot-Reload beim Speichern',
      'custom.css oluşturuldu ve açılıyor; kaydetmede otomatik yenilenir',
    ],
    cssFontOverrideTooltip: [
      '当前由 custom.css 覆写，删除对应变量即可恢复面板控制',
      '目前由 custom.css 覆寫，刪除對應變數即可恢復面板控制',
      'Overridden by custom.css — remove the matching variable to restore panel control',
      'custom.css で上書きされています。該当する変数を削除するとパネル設定に戻ります',
      'custom.css에서 재정의됨 — 해당 변수를 삭제하면 패널 제어로 복원됩니다',
      'Anulado por custom.css — elimina la variable correspondiente para restaurar el control del panel',
      'Remplacé par custom.css — supprimez la variable correspondante pour rétablir le contrôle du panneau',
      'Von custom.css überschrieben — entferne die entsprechende Variable, um die Steuerung wiederherzustellen',
      'custom.css tarafından geçersiz kılındı — panel kontrolünü geri yüklemek için ilgili değişkeni kaldırın',
    ],
    fontPickerSearchPlaceholder: [
      '搜索字体或输入字体栈...',
      '搜尋字型或輸入字型...',
      'Search fonts or enter stack...',
      'フォントを検索・入力...',
      '글꼴 검색 또는 입력...',
      'Buscar o escribir fuente...',
      'Rechercher ou saisir...',
      'Schrift suchen / eingeben...',
      'Yazı tipi ara veya yaz...',
    ],
    fontPickerGroupPresets: [
      '推荐预设',
      '推薦預設',
      'Recommended Presets',
      'おすすめプリセット',
      '추천 프리셋',
      'Preajustes recomendados',
      'Préréglages recommandés',
      'Empfohlene Vorlagen',
      'Önerilen Ön Ayarlar',
    ],
    fontPickerGroupLocal: [
      '本机已安装字体',
      '本機已安裝字型',
      'Installed Local Fonts',
      'インストール済みフォント',
      '설치된 로컬 글꼴',
      'Fuentes locales instaladas',
      'Polices locales installées',
      'Installierte lokale Schriften',
      'Yüklü Yerel Yazı Tipleri',
    ],
    fontPickerApplyCustom: [
      '应用自定义字体栈：{stack}',
      '套用自訂字型堆疊：{stack}',
      'Apply custom stack: {stack}',
      'カスタムフォントを適用：{stack}',
      '사용자 지정 글꼴 적용: {stack}',
      'Aplicar pila personalizada: {stack}',
      'Appliquer la pile personnalisée : {stack}',
      'Benutzerdefinierten Stack anwenden: {stack}',
      'Özel yazı tipi yığınını uygula: {stack}',
    ],
    fontPickerEmpty: [
      '未找到匹配的字体，按 Enter 可直接应用自定义字体栈',
      '找不到相符的字型，按 Enter 可直接套用自訂字型堆疊',
      'No matching fonts; press Enter to apply as custom stack',
      '一致するフォントがありません。Enter でカスタム適用できます',
      '일치하는 글꼴이 없습니다. Enter를 눌러 사용자 지정으로 적용하세요',
      'Sin coincidencias; pulsa Enter para aplicar como pila personalizada',
      'Aucune correspondance ; appuyez sur Entrée pour appliquer la pile',
      'Keine Treffer; Eingabetaste drückt benutzerdefinierten Stack an',
      'Eşleşme yok; özel yığın olarak uygulamak için Enter’a basın',
    ],
    fontPickerResetDefault: [
      '恢复默认',
      '恢復預設',
      'Reset to Default',
      '既定に戻す',
      '기본값으로 복원',
      'Restablecer predeterminada',
      'Réinitialiser par défaut',
      'Auf Standard zurücksetzen',
      'Varsayılana Sıfırla',
    ],
    fontPickerCurrentCustom: [
      '当前自定义',
      '目前自訂',
      'Current Custom',
      '現在のカスタム',
      '현재 사용자 지정',
      'Personalizada actual',
      'Personnalisée actuelle',
      'Aktuell benutzerdefiniert',
      'Mevcut Özel',
    ],
    fontPickerInvalidStack: [
      '未检测到有效字体名，已忽略不安全字符',
      '未偵測到有效字型名，已忽略不安全字元',
      'No valid font family names found; unsafe characters were ignored',
      '有効なフォント名がありません（安全でない文字は除外されました）',
      '유효한 글꼴 이름이 없습니다 (안전하지 않은 문자 제외)',
      'No se encontraron nombres de fuente válidos; caracteres no seguros ignorados',
      'Aucun nom de police valide ; caractères non sûrs ignorés',
      'Keine gültigen Schriftartnamen gefunden; unsichere Zeichen ignoriert',
      'Geçerli yazı tipi adı bulunamadı; güvenli olmayan karakterler yoksayıldı',
    ],
  });

  function normalizeLocale(lang) {
    const raw = typeof lang === 'string' ? lang.trim().toLowerCase().replace(/_/g, '-') : '';
    if (!raw || raw === 'auto') return 'en';
    if (raw === 'zh-tw' || raw === 'zh-hk' || raw.startsWith('zh-hk-') || raw === 'zh-mo' || raw === 'zh-hant' || raw.startsWith('zh-hant-')) return 'zh-TW';
    if (raw === 'zh' || raw === 'zh-cn' || raw === 'zh-hans' || raw.startsWith('zh-') || raw === 'yue' || raw.startsWith('yue-') || raw === 'zh-yue' || raw.includes('cantonese')) return 'zh-CN';
    if (raw === 'ja' || raw.startsWith('ja-')) return 'ja';
    if (raw === 'ko' || raw.startsWith('ko-')) return 'ko';
    if (raw === 'es' || raw.startsWith('es-')) return 'es';
    if (raw === 'fr' || raw.startsWith('fr-')) return 'fr';
    if (raw === 'de' || raw.startsWith('de-')) return 'de';
    if (raw === 'tr' || raw.startsWith('tr-') || raw === 'turkish' || raw === 'türkçe' || raw === 'turkce') return 'tr';
    return 'en';
  }

  function getStrings(lang) {
    const idx = LOCALE_INDEX[normalizeLocale(lang)] ?? 2;
    const out = {};
    for (const key of Object.keys(TABLE)) {
      out[key] = TABLE[key][idx];
    }
    return out;
  }

  return {
    LOCALES,
    TABLE,
    normalizeLocale,
    getStrings,
  };
});
