// Obsidian Prism - Project Partitions UI primitives, 9-locale i18n, icons & compact CSS
(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const NS = 'http://www.w3.org/2000/svg';
  const STORAGE_KEY = 'ag-prism:project-partitions.v1';
  const STYLE_ID = 'ag-prism-project-partitions-css';
  const HIDE_STYLE_ID = 'ag-prism-part-hide-css';
  const ROOT_ATTR = 'data-ag-prism-project-partitions';
  const MAX_VISIBLE_CONVS = 8;

  const NO_TR_PAIRS = [
    ['translate', 'no'],
    ['data-no-translate', 'true'],
    ['data-ag-localization-skip', 'true'],
    ['data-agy-no-translate', 'true'],
    ['data-antigravity-zh-skip', '1'],
    ['data-ag-no-i18n', ''],
    ['data-ag-owned', '1'],
  ];

  // Pure ASCII CSS, zero backdrop-filter, balanced delimiters
  const PARTITIONS_CSS = [
    '.ag-prism-part-popup,.ag-prism-part-dialog{--ag-prism-pp-bg:var(--ag-cs-ov-bg,var(--ag-cs-menu-bg,rgba(14,16,22,.96)));--ag-prism-pp-dlg-bg:var(--ag-cs-panel-bg,var(--card,#181920));--ag-prism-pp-bd:var(--ag-cs-menu-bd,rgba(255,255,255,.10));--ag-prism-pp-sh:inset 0 1px 0 rgba(255,255,255,.12),0 22px 48px -14px rgba(0,0,0,.70);--ag-prism-pp-hv:rgba(186,210,255,.075);--ag-prism-pp-sel:rgba(130,174,255,.11);--ag-prism-pp-err:#F28B82;--ag-prism-pp-sep:rgba(214,226,255,.10);--ag-prism-pp-inp:var(--ag-cs-tonal-0,rgba(0,0,0,.22));}',
    'html[data-ag-cs-style][data-ag-cs-theme="light"] :is(.ag-prism-part-popup,.ag-prism-part-dialog),html[data-ag-cs-style]>body:is(.theme-light,.light-theme,.light) :is(.ag-prism-part-popup,.ag-prism-part-dialog){--ag-prism-pp-bg:var(--ag-cs-menu-bg-l,rgba(252,253,255,.97));--ag-prism-pp-dlg-bg:var(--ag-cs-panel-bg,rgba(255,255,255,.98));--ag-prism-pp-bd:rgba(15,23,42,.10);--ag-prism-pp-sh:0 1px 3px rgba(15,23,42,.08),0 18px 38px -12px rgba(15,23,42,.15);--ag-prism-pp-hv:rgba(15,23,42,.052);--ag-prism-pp-sel:color-mix(in srgb,var(--primary,#2563EB) 10%,transparent);--ag-prism-pp-err:#DC2626;--ag-prism-pp-sep:rgba(15,23,42,.09);--ag-prism-pp-inp:#FFFFFF;}',
    '.ag-prism-partitions-root{display:flex;flex-direction:column;gap:4px;padding:2px 0 6px;width:100%;box-sizing:border-box;contain:style;user-select:none;}',
    '.ag-prism-part-section,.ag-prism-part-project{display:flex;flex-direction:column;width:100%;}',
    '.ag-prism-part-sec-head{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:4px 6px 4px 8px;min-height:24px;box-sizing:border-box;border-radius:var(--ag-cs-r-sm,8px);}',
    '.ag-prism-part-sec-toggle{appearance:none;border:none;background:transparent;padding:0;margin:0;flex:1 1 auto;min-width:0;display:inline-flex;align-items:center;gap:3px;cursor:pointer;text-align:left;font-family:inherit;font-size:11.5px;font-weight:600;letter-spacing:.02em;color:color-mix(in srgb,var(--foreground) 74%,transparent);transition:color 140ms ease;}',
    '.ag-prism-part-sec-toggle:hover{color:var(--foreground);}',
    '.ag-prism-part-sec-title,.ag-prism-part-proj-name,.ag-prism-part-conv-title,.ag-prism-part-popup-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    '.ag-prism-part-proj-name,.ag-prism-part-conv-title,.ag-prism-part-popup-label{flex:1 1 auto;min-width:0;}',
    '.ag-prism-part-sec-chev{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;opacity:0;transform:rotate(90deg);transition:opacity 150ms ease,transform 160ms var(--ag-ease-spring,cubic-bezier(.34,1.4,.64,1));}',
    '.ag-prism-part-sec-head:hover .ag-prism-part-sec-chev,.ag-prism-part-sec-head:focus-within .ag-prism-part-sec-chev{opacity:.65;}',
    '.ag-prism-part-section[data-collapsed="true"] .ag-prism-part-sec-chev{opacity:.58;transform:rotate(0deg);}',
    '.ag-prism-part-sec-actions{display:inline-flex;align-items:center;gap:2px;flex-shrink:0;opacity:0;pointer-events:none;transition:opacity 140ms ease;}',
    '.ag-prism-part-sec-head:hover .ag-prism-part-sec-actions,.ag-prism-part-sec-head:focus-within .ag-prism-part-sec-actions{opacity:1;pointer-events:auto;}',
    '.ag-prism-part-add-btn{height:20px !important;width:20px !important;padding:0 !important;border:0 !important;background:transparent !important;color:var(--muted-foreground) !important;border-radius:6px !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;cursor:pointer !important;flex-shrink:0 !important;transition:background-color 120ms ease,color 120ms ease !important;}',
    '.ag-prism-part-add-btn:hover{background-color:var(--sidebar-secondary,var(--secondary)) !important;color:var(--foreground) !important;}',
    '.ag-prism-part-icon-btn{appearance:none;border:none;background:transparent;color:var(--muted-foreground);width:20px;height:20px;padding:0;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background-color 120ms ease,color 120ms ease,transform 120ms ease;}',
    '.ag-prism-part-icon-btn:hover{background:var(--sidebar-secondary,var(--ag-cs-hover-wash,rgba(255,255,255,.08)));color:var(--foreground);}',
    '.ag-prism-part-icon-btn:active{transform:scale(.92);}',
    '.ag-prism-part-grid{display:grid;grid-template-rows:1fr;opacity:1;transition:grid-template-rows 200ms var(--ag-ease-out,cubic-bezier(.22,1,.36,1)),opacity 160ms ease;}',
    '.ag-prism-part-grid[data-collapsed="1"]{grid-template-rows:0fr;opacity:0;pointer-events:none;}',
    '.ag-prism-part-grid-inner{overflow:hidden;display:flex;flex-direction:column;gap:1px;}',
    '.ag-prism-part-proj-row{position:relative;display:flex;align-items:center;width:100%;}',
    '.ag-prism-part-proj-btn{appearance:none;border:none;background:transparent;width:100%;min-height:28px;height:28px;padding:4px 50px 4px 10px;border-radius:var(--ag-cs-r-sm,8px);display:flex;align-items:center;gap:6px;cursor:pointer;text-align:left;font-family:inherit;font-size:12.5px;font-weight:500;color:var(--secondary-foreground);transition:background-color 120ms ease,color 120ms ease;}',
    '.ag-prism-part-proj-btn:hover,.ag-prism-part-proj-row:hover .ag-prism-part-proj-btn{background:var(--_sr,var(--sidebar-muted,rgba(255,255,255,.05)));color:var(--foreground);}',
    '.ag-prism-part-proj-icon{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex-shrink:0;color:var(--muted-foreground);transition:color 120ms ease;}',
    '.ag-prism-part-proj-row:hover .ag-prism-part-proj-icon,.ag-prism-part-project[data-expanded="1"]>.ag-prism-part-proj-row .ag-prism-part-proj-icon{color:var(--secondary-foreground);}',
    '.ag-prism-part-proj-actions{position:absolute;right:4px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;gap:2px;opacity:0;pointer-events:none;transition:opacity 120ms ease;z-index:2;}',
    '.ag-prism-part-proj-row:hover .ag-prism-part-proj-actions,.ag-prism-part-proj-row:focus-within .ag-prism-part-proj-actions{opacity:1;pointer-events:auto;}',
    '.ag-prism-part-conv-list{padding:1px 0 2px;display:flex;flex-direction:column;gap:1px;}',
    '.ag-prism-part-conv-row{position:relative;appearance:none;border:none;background:transparent;width:100%;min-height:29px;padding:5px 8px 5px 30px;border-radius:var(--ag-cs-r-md,10px);display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;text-align:left;font-family:inherit;font-size:13px;line-height:1.35;color:var(--secondary-foreground);transition:background-color 120ms ease,color 120ms ease;}',
    '.ag-prism-part-conv-row:hover{background:var(--_sr,var(--sidebar-muted,rgba(255,255,255,.05)));color:var(--foreground);}',
    '.ag-prism-part-conv-meta{display:inline-flex;align-items:center;gap:4px;flex-shrink:0;color:var(--muted-foreground);font-size:11px;font-variant-numeric:tabular-nums;}',
    '.ag-prism-part-conv-time{opacity:.72;}',
    '.ag-prism-part-pin{display:inline-flex;align-items:center;color:var(--primary);opacity:.82;}',
    '.ag-prism-part-spinner{display:grid;place-content:center;width:14px;height:14px;grid-template-columns:repeat(2,3.5px);gap:2px;opacity:.8;}',
    '.ag-prism-part-spinner span{width:3.5px;height:3.5px;border-radius:999px;background:currentColor;animation:agentStateDot 1.4s ease-in-out infinite;}',
    '.ag-prism-part-empty{padding:4px 12px;font-size:11.5px;color:var(--muted-foreground);opacity:.62;}',
    '.ag-prism-part-empty-conv{padding-left:30px;}',
    '.ag-prism-part-more-convs{appearance:none;border:none;background:transparent;padding:3px 8px 3px 30px;border-radius:var(--ag-cs-r-sm,8px);text-align:left;font-family:inherit;font-size:11.5px;color:var(--muted-foreground);cursor:pointer;transition:color 120ms ease,background-color 120ms ease;}',
    '.ag-prism-part-more-convs:hover{color:var(--foreground);background:var(--_sr,rgba(255,255,255,.04));}',
    '.ag-prism-part-menu-item{width:100%;display:flex !important;align-items:center !important;gap:8px !important;border:0 !important;background:transparent;color:var(--foreground);text-align:left;cursor:pointer;font-family:inherit;box-sizing:border-box;}',
    '.ag-prism-part-menu-badge{max-width:74px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:1;padding:2px 6px;border-radius:999px;background:color-mix(in srgb,var(--primary,#669DF6) 14%,transparent);color:var(--primary,#8AB4F8);flex-shrink:0;}',
    '.ag-prism-part-menu-chev{display:inline-flex;align-items:center;margin-left:2px;opacity:.65;flex-shrink:0;}',
    '.ag-prism-part-popup{position:fixed;z-index:2147483640;min-width:176px;max-width:250px;padding:5px;border-radius:13px;background-color:var(--ag-prism-pp-bg);background-image:radial-gradient(110% 64px at 50% 0%,rgba(255,255,255,.046),transparent 72%),linear-gradient(rgba(255,255,255,.024) 0%,transparent 36%);border:1px solid var(--ag-prism-pp-bd);box-shadow:var(--ag-prism-pp-sh);color:var(--foreground);font-family:var(--font-sans,inherit);display:flex;flex-direction:column;gap:1px;box-sizing:border-box;animation:ag-part-pop-in 140ms var(--ag-ease-out,cubic-bezier(.22,1,.36,1)) both;}',
    '@keyframes ag-part-pop-in{from{opacity:0;transform:scale(.965);}to{opacity:1;transform:scale(1);}}',
    '.ag-prism-part-popup-item{appearance:none;border:none;background:transparent;color:var(--foreground);width:100%;min-height:30px;padding:4px 9px;border-radius:8px;display:flex;align-items:center;gap:8px;font-size:13px;line-height:18px;font-family:inherit;cursor:pointer;text-align:left;transition:background-color 120ms ease,color 120ms ease;}',
    '.ag-prism-part-popup-item:hover:not(:disabled),.ag-prism-part-popup-item[data-highlighted="1"]{background-color:var(--ag-prism-pp-hv);color:var(--foreground);}',
    '.ag-prism-part-popup-item.is-selected{background-color:var(--ag-prism-pp-sel);font-weight:500;}',
    '.ag-prism-part-popup-item.is-danger{color:var(--ag-prism-pp-err);}',
    '.ag-prism-part-popup-item.is-danger:hover:not(:disabled){background-color:rgba(234,67,53,.13);color:#FCA5A5;}',
    '.ag-prism-part-popup-item:disabled{opacity:.38;cursor:default;}',
    '.ag-prism-part-popup-icon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex-shrink:0;opacity:.82;}',
    '.ag-prism-part-popup-check{display:inline-flex;align-items:center;color:var(--primary,#8AB4F8);flex-shrink:0;}',
    '.ag-prism-part-popup-sep{height:1px;margin:4px 8px;background:linear-gradient(90deg,transparent,var(--ag-prism-pp-sep) 14%,var(--ag-prism-pp-sep) 86%,transparent);}',
    '.ag-prism-part-popup-empty{padding:6px 10px;font-size:12px;color:var(--muted-foreground);opacity:.72;}',
    '.ag-prism-part-dialog-backdrop{position:fixed;inset:0;z-index:2147483645;background:rgba(0,0,0,.44);display:flex;align-items:center;justify-content:center;padding:16px;}',
    '.ag-prism-part-dialog{width:min(340px,100%);padding:16px;border-radius:14px;background-color:var(--ag-prism-pp-dlg-bg);border:1px solid var(--ag-prism-pp-bd);box-shadow:var(--ag-prism-pp-sh);color:var(--foreground);font-family:var(--font-sans,inherit);display:flex;flex-direction:column;gap:10px;box-sizing:border-box;animation:ag-part-pop-in 150ms var(--ag-ease-out,cubic-bezier(.22,1,.36,1)) both;}',
    '.ag-prism-part-dialog-title{font-size:14px;font-weight:600;color:var(--foreground);}',
    '.ag-prism-part-dialog-input{width:100%;height:34px;padding:0 10px;border-radius:9px;border:1px solid var(--ag-prism-pp-bd);background:var(--ag-prism-pp-inp);color:var(--foreground);font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color 130ms ease,box-shadow 130ms ease;}',
    '.ag-prism-part-dialog-input:focus{border-color:var(--primary,#669DF6);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary,#669DF6) 24%,transparent);}',
    '.ag-prism-part-dialog-err{min-height:14px;font-size:11.5px;color:var(--ag-prism-pp-err);}',
    '.ag-prism-part-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;}',
    '.ag-prism-part-btn{appearance:none;height:30px;padding:0 12px;border-radius:8px;border:1px solid var(--ag-prism-pp-bd);background:transparent;color:var(--secondary-foreground);font-size:12.5px;font-weight:500;font-family:inherit;cursor:pointer;transition:background-color 120ms ease,color 120ms ease,border-color 120ms ease;}',
    '.ag-prism-part-btn:hover{background:var(--ag-cs-hover-wash,rgba(255,255,255,.06));color:var(--foreground);}',
    '.ag-prism-part-btn-primary{border-color:transparent;background:var(--primary,#669DF6);color:var(--primary-foreground,#FFFFFF);}',
    '.ag-prism-part-btn-primary:hover{filter:brightness(1.08);background:var(--primary,#669DF6);color:var(--primary-foreground,#FFFFFF);}',
    'html[data-ag-cs-style][data-ag-cs-sidebar="on"][data-ag-cs-sidebar-compact="on"] .ag-prism-part-sec-head{min-height:20px;padding-top:2px;padding-bottom:1px;}',
    'html[data-ag-cs-style][data-ag-cs-sidebar="on"][data-ag-cs-sidebar-compact="on"] .ag-prism-part-proj-btn{min-height:24px;height:24px;padding-top:1px;padding-bottom:1px;}',
    'html[data-ag-cs-style][data-ag-cs-sidebar="on"][data-ag-cs-sidebar-compact="on"] .ag-prism-part-conv-row{min-height:25px;padding-top:3px;padding-bottom:3px;}',
    'html[data-ag-cs-style][data-ag-cs-sidebar-collapsed="1"] .ag-prism-partitions-root{display:none !important;}',
    '@media (prefers-reduced-motion:reduce){.ag-prism-part-popup,.ag-prism-part-dialog,.ag-prism-part-grid,.ag-prism-part-spinner span{animation:none !important;transition:none !important;}}',
    'html[data-ag-cs-style][data-ag-cs-motion="off"] :is(.ag-prism-part-popup,.ag-prism-part-dialog,.ag-prism-part-grid,.ag-prism-part-spinner span){animation:none !important;transition:none !important;}',
    'html[data-ag-cs-style][data-ag-cs-perf-mode="performance"][data-ag-cs-win-blur="1"] .ag-prism-part-spinner span{animation-play-state:paused !important;}',
  ].join('\n');

  const I18N_KEYS = [
    'partition', 'newPartition', 'renamePartition', 'deletePartition', 'moveUp', 'moveDown',
    'removeFromPartition', 'noPartitions', 'emptyProjects', 'emptyConvs', 'copyProjectName',
    'projectSettings', 'revealInExplorer', 'deleteProject', 'newConvInProject', 'projectOptions',
    'partitionOptions', 'showMore', 'showLess', 'inputPlaceholder', 'confirm', 'cancel',
    'copied', 'movedTo', 'removedToast', 'createdToast', 'renamedToast', 'deletedToast',
    'duplicateName', 'emptyName', 'untitled', 'now',
  ];
  const I18N_PACKS = {
    'zh-CN': '分区|新建分区|重命名分区|删除分区|上移分区|下移分区|移出分区|暂无分区|暂无项目|暂无会话|复制项目名称|项目配置|在文件资源管理器中显示|删除项目|在项目中新建会话|项目选项|分区选项|显示更多|收起|输入分区名称|确定|取消|已复制项目名称|已归入分区「{0}」|已移回 Projects|已创建分区「{0}」|已重命名为「{0}」|已删除分区，项目已移回 Projects|已存在同名分区|分区名称不能为空|未命名会话|刚刚',
    'zh-TW': '分區|新建分區|重新命名分區|刪除分區|上移分區|下移分區|移出分區|暫無分區|暫無專案|暫無會話|複製專案名稱|專案設定|在檔案總管中顯示|刪除專案|在專案中新建會話|專案選項|分區選項|顯示更多|收起|輸入分區名稱|確定|取消|已複製專案名稱|已歸入分區「{0}」|已移回 Projects|已建立分區「{0}」|已重新命名為「{0}」|已刪除分區，專案已移回 Projects|已存在同名分區|分區名稱不能為空|未命名會話|剛剛',
    en: 'Partition|New Partition|Rename Partition|Delete Partition|Move Up|Move Down|Remove from Partition|No partitions yet|No projects|No conversations|Copy Project Name|Project Settings|Show in File Explorer|Delete Project|New Conversation in Project|Project options|Partition options|Show more|Show less|Partition name|Confirm|Cancel|Project name copied|Moved to "{0}"|Moved back to Projects|Created partition "{0}"|Renamed to "{0}"|Partition deleted; projects returned to Projects|Partition name already exists|Partition name cannot be empty|Untitled|now',
    ja: 'セクション|新しいセクション|名前を変更|セクションを削除|上へ移動|下へ移動|セクションから外す|セクションなし|プロジェクトなし|会話なし|プロジェクト名をコピー|プロジェクト設定|エクスプローラーで表示|プロジェクトを削除|新しい会話を開始|プロジェクトオプション|セクションオプション|もっと見る|折りたたむ|セクション名を入力|確定|キャンセル|プロジェクト名をコピーしました|「{0}」へ移動しました|Projects に戻しました|「{0}」を作成しました|「{0}」に変更しました|セクションを削除しました|同名のセクションが存在します|名前を入力してください|無題の会話|今',
    ko: '섹션|새 섹션|이름 변경|섹션 삭제|위로 이동|아래로 이동|섹션에서 제거|섹션 없음|프로젝트 없음|대화 없음|프로젝트 이름 복사|프로젝트 설정|탐색기에서 표시|프로젝트 삭제|프로젝트에서 새 대화|프로젝트 옵션|섹션 옵션|더 보기|접기|섹션 이름 입력|확인|취소|프로젝트 이름을 복사했습니다|"{0}" 섹션으로 이동됨|Projects로 이동됨|"{0}" 섹션 생성됨|"{0}"(으)로 변경됨|섹션이 삭제되었습니다|같은 이름의 섹션이 있습니다|이름을 입력하세요|제목 없음|방금',
    es: 'Sección|Nueva sección|Renombrar sección|Eliminar sección|Subir|Bajar|Quitar de la sección|Sin secciones|Sin proyectos|Sin conversaciones|Copiar nombre|Configuración|Mostrar en explorador|Eliminar proyecto|Nueva conversación|Opciones del proyecto|Opciones de sección|Mostrar más|Mostrar menos|Nombre de sección|Aceptar|Cancelar|Nombre copiado|Movido a "{0}"|Devuelto a Projects|Sección "{0}" creada|Renombrado a "{0}"|Sección eliminada|Ya existe esa sección|El nombre no puede estar vacío|Sin título|ahora',
    fr: 'Section|Nouvelle section|Renommer|Supprimer la section|Monter|Descendre|Retirer de la section|Aucune section|Aucun projet|Aucune conversation|Copier le nom|Paramètres du projet|Afficher dans l\'explorateur|Supprimer le projet|Nouvelle conversation|Options du projet|Options de section|Afficher plus|Réduire|Nom de la section|Confirmer|Annuler|Nom copié|Déplacé vers "{0}"|Replacé dans Projects|Section "{0}" créée|Renommé en "{0}"|Section supprimée|Cette section existe déjà|Le nom ne peut pas être vide|Sans titre|maintenant',
    de: 'Bereich|Neuer Bereich|Umbenennen|Bereich löschen|Nach oben|Nach unten|Aus Bereich entfernen|Keine Bereiche|Keine Projekte|Keine Unterhaltungen|Projektname kopieren|Projekteinstellungen|Im Explorer anzeigen|Projekt löschen|Neue Unterhaltung|Projektoptionen|Bereichsoptionen|Mehr anzeigen|Weniger|Bereichsname|Bestätigen|Abbrechen|Name kopiert|Nach "{0}" verschoben|Zurück in Projects|Bereich "{0}" erstellt|Umbenannt in "{0}"|Bereich gelöscht|Bereich existiert bereits|Name darf nicht leer sein|Unbenannt|jetzt',
    tr: 'Bölüm|Yeni Bölüm|Bölümü Yeniden Adlandır|Bölümü Sil|Yukarı Taşı|Aşağı Taşı|Bölümden Çıkar|Henüz bölüm yok|Proje yok|Sohbet yok|Proje Adını Kopyala|Proje Ayarları|Dosya Gezgininde Göster|Projeyi Sil|Projede Yeni Sohbet|Proje seçenekleri|Bölüm seçenekleri|Daha fazla göster|Daha az göster|Bölüm adı|Onayla|İptal|Proje adı kopyalandı|"{0}" bölümüne taşındı|Projects listesine geri taşındı|"{0}" bölümü oluşturuldu|"{0}" olarak yeniden adlandırıldı|Bölüm silindi; projeler Projects listesine döndü|Bu bölüm adı zaten var|Bölüm adı boş olamaz|Adsız|şimdi',
  };
  const I18N = {};
  for (const [k, raw] of Object.entries(I18N_PACKS)) {
    const arr = raw.split('|');
    const obj = {};
    for (let i = 0; i < I18N_KEYS.length; i++) obj[I18N_KEYS[i]] = arr[i] || '';
    I18N[k] = obj;
  }

  const ICON_PATHS = {
    partition: ['M3 6.5A1.5 1.5 0 0 1 4.5 5H10l1.6 1.8H19.5A1.5 1.5 0 0 1 21 8.3V17.5A1.5 1.5 0 0 1 19.5 19H4.5A1.5 1.5 0 0 1 3 17.5Z', 'M3 10.5H21'],
    partitionAdd: ['M3 6.5A1.5 1.5 0 0 1 4.5 5H10l1.6 1.8H19.5A1.5 1.5 0 0 1 21 8.3V11', 'M3 10.5H13', 'M3 6.5V17.5A1.5 1.5 0 0 0 4.5 19H12', 'M17.5 13.5V20.5', 'M14 17H21'],
    folder: ['M3 7.5A2 2 0 0 1 5 5.5H9.6L11.4 7.5H19A2 2 0 0 1 21 9.5V17A2 2 0 0 1 19 19H5A2 2 0 0 1 3 17Z'],
    folderOpen: ['M3 7.5A2 2 0 0 1 5 5.5H9.4L11.2 7.5H18.5A1.5 1.5 0 0 1 20 9V10.5H5.5L3 17.5Z', 'M5.5 10.5H21L18.8 18A1.5 1.5 0 0 1 17.4 19H4.2A1.2 1.2 0 0 1 3.1 17.4Z'],
    chevronRight: ['M9 6L15 12L9 18'],
    check: ['M5 12.5L9.5 17L19 7.5'],
    plus: ['M12 5V19', 'M5 12H19'],
    moreVert: ['M12 5.5A1 1 0 1 0 12 7.5A1 1 0 1 0 12 5.5Z', 'M12 11A1 1 0 1 0 12 13A1 1 0 1 0 12 11Z', 'M12 16.5A1 1 0 1 0 12 18.5A1 1 0 1 0 12 16.5Z'],
    copy: ['M9 9H19V19H9Z', 'M5 15H4A1.5 1.5 0 0 1 2.5 13.5V4.5A1.5 1.5 0 0 1 4 3H13A1.5 1.5 0 0 1 14.5 4.5V5.5'],
    settings: ['M12 15A3 3 0 1 0 12 9A3 3 0 0 0 12 15Z', 'M19.4 15A1.65 1.65 0 0 0 19.73 16.82L19.79 16.88A2 2 0 1 1 16.96 19.71L16.9 19.65A1.65 1.65 0 0 0 15.08 19.32A1.65 1.65 0 0 0 14 20.84V21A2 2 0 1 1 10 21V20.91A1.65 1.65 0 0 0 8.92 19.4A1.65 1.65 0 0 0 7.1 19.73L7.04 19.79A2 2 0 1 1 4.21 16.96L4.27 16.9A1.65 1.65 0 0 0 4.6 15.08A1.65 1.65 0 0 0 3.09 14H3A2 2 0 1 1 3 10H3.09A1.65 1.65 0 0 0 4.6 8.92A1.65 1.65 0 0 0 4.27 7.1L4.21 7.04A2 2 0 1 1 7.04 4.21L7.1 4.27A1.65 1.65 0 0 0 8.92 4.6H9A1.65 1.65 0 0 0 10 3.09V3A2 2 0 1 1 14 3V3.09A1.65 1.65 0 0 0 15 4.6A1.65 1.65 0 0 0 16.82 4.27L16.88 4.21A2 2 0 1 1 19.71 7.04L19.65 7.1A1.65 1.65 0 0 0 19.32 8.92V9A1.65 1.65 0 0 0 20.84 10H21A2 2 0 1 1 21 14H20.91A1.65 1.65 0 0 0 19.4 15Z'],
    external: ['M14 4H20V10', 'M10 14L20 4', 'M20 14V18.5A1.5 1.5 0 0 1 18.5 20H5.5A1.5 1.5 0 0 1 4 18.5V5.5A1.5 1.5 0 0 1 5.5 4H10'],
    trash: ['M3 6H21', 'M8 6V4H16V6', 'M6 6L7 20A1.5 1.5 0 0 0 8.5 21H15.5A1.5 1.5 0 0 0 17 20L18 6'],
    edit: ['M12 20H21', 'M16.5 3.5A2.12 2.12 0 0 1 19.5 6.5L7 19L3 20L4 16Z'],
    arrowUp: ['M12 19V5', 'M6 11L12 5L18 11'],
    arrowDown: ['M12 5V19', 'M6 13L12 19L18 13'],
    undo: ['M9 14L4 9L9 4', 'M20 20V13A4 4 0 0 0 16 9H4'],
    pin: ['M12 17V22', 'M5 17H19V15L17 13V7L19 5V4H5V5L7 7V13L5 15Z'],
  };

  const safe = (fn) => { try { return fn(); } catch { return undefined; } };
  const fmt = (tpl, ...args) => String(tpl || '').replace(/\{(\d+)\}/g, (_, i) => String(args[+i] ?? ''));
  const cssEsc = (s) => (typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));

  function resolveLang(raw) {
    const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-');
    if (s.startsWith('zh-tw') || s.startsWith('zh-hk') || s.startsWith('zh-mo') || s.startsWith('zh-hant')) return 'zh-TW';
    if (s.startsWith('zh') || s === 'yue' || s.startsWith('yue-') || s.includes('cantonese')) return 'zh-CN';
    if (s.startsWith('ja')) return 'ja';
    if (s.startsWith('ko')) return 'ko';
    if (s.startsWith('es')) return 'es';
    if (s.startsWith('fr')) return 'fr';
    if (s.startsWith('de')) return 'de';
    if (s.startsWith('tr') || s === 'turkish') return 'tr';
    return 'en';
  }

  function markOwned(node) {
    if (node && node.setAttribute) {
      for (let i = 0; i < NO_TR_PAIRS.length; i++) node.setAttribute(NO_TR_PAIRS[i][0], NO_TR_PAIRS[i][1]);
    }
    return node;
  }

  function el(doc, tag, cls, text, attrs) {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (tag === 'button') node.type = 'button';
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v !== undefined && v !== null) node.setAttribute(k, String(v));
      }
    }
    return node;
  }

  function makeIcon(doc, name, size = 15) {
    const svg = doc.createElementNS(NS, 'svg');
    const solid = name === 'moreVert';
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', solid ? 'currentColor' : 'none');
    svg.setAttribute('stroke', solid ? 'none' : 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const paths = ICON_PATHS[name] || [];
    for (let i = 0; i < paths.length; i++) {
      const p = doc.createElementNS(NS, 'path');
      p.setAttribute('d', paths[i]);
      svg.appendChild(p);
    }
    return svg;
  }

  function formatRelativeTime(tsMs, nowLabel) {
    if (!tsMs) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
    if (diffSec < 60) return nowLabel || 'now';
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`;
  }

  function buildRunningDots(doc) {
    const wrap = el(doc, 'span', 'ag-prism-part-spinner', null, { 'aria-hidden': 'true', 'data-testid': 'status-loading-spinner' });
    for (const d of ['0s', '-1.05s', '-0.35s', '-0.7s']) {
      const dot = el(doc, 'span', null, null, { 'data-agent-state-dot': '' });
      dot.style.animationDelay = d;
      wrap.appendChild(dot);
    }
    return wrap;
  }

  function positionPopup(win, node, anchorRect, mode = 'below') {
    if (!node || !anchorRect || !win) return;
    node.style.visibility = 'hidden';
    node.style.left = '0px';
    node.style.top = '0px';
    const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : { width: 180, height: 140 };
    const vw = win.innerWidth || 1280;
    const vh = win.innerHeight || 800;
    let left;
    let top;
    if (mode === 'beside') {
      const gap = 6;
      left = anchorRect.right + gap;
      if (left + rect.width > vw - 8) {
        const alt = anchorRect.left - rect.width - gap;
        left = alt >= 8 ? alt : Math.max(8, vw - rect.width - 8);
      }
      if (left < 8) left = 8;
      top = anchorRect.top - 5;
      if (top + rect.height > vh - 8) top = Math.max(8, vh - rect.height - 8);
      if (top < 8) top = 8;
    } else {
      left = anchorRect.left;
      if (left + rect.width > vw - 8) left = Math.max(8, anchorRect.right - rect.width);
      top = anchorRect.bottom + 5;
      if (top + rect.height > vh - 8) top = Math.max(8, anchorRect.top - rect.height - 5);
    }
    node.style.left = Math.round(left) + 'px';
    node.style.top = Math.round(top) + 'px';
    node.style.visibility = '';
  }

  function buildPopupMenu(doc, { className = 'ag-prism-part-popup', attrs = null, items = [], onPointerEnter = null, onPointerLeave = null }) {
    const menu = markOwned(el(doc, 'div', className, null, Object.assign({ role: 'menu' }, attrs || {})));
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it) continue;
      if (it.sep) {
        menu.appendChild(el(doc, 'div', 'ag-prism-part-popup-sep', null, { role: 'separator' }));
        continue;
      }
      if (it.empty) {
        menu.appendChild(el(doc, 'div', 'ag-prism-part-popup-empty', it.empty));
        continue;
      }
      if (it.node) {
        menu.appendChild(it.node);
        continue;
      }
      const cls = 'ag-prism-part-popup-item' + (it.checked ? ' is-selected' : '') + (it.danger ? ' is-danger' : '');
      const btn = el(doc, 'button', cls, null, { role: 'menuitem' });
      if (it.disabled) btn.disabled = true;
      const ic = el(doc, 'span', 'ag-prism-part-popup-icon');
      ic.appendChild(makeIcon(doc, it.icon, it.iconSize || 14));
      btn.appendChild(ic);
      btn.appendChild(el(doc, 'span', 'ag-prism-part-popup-label', it.label));
      if (it.checked) {
        const chk = el(doc, 'span', 'ag-prism-part-popup-check');
        chk.appendChild(makeIcon(doc, 'check', 14));
        btn.appendChild(chk);
      }
      if (it.stopPointerDown) btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      if (it.onPointerEnter) btn.addEventListener('pointerenter', it.onPointerEnter);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof it.onClick === 'function') it.onClick();
      });
      menu.appendChild(btn);
    }
    if (onPointerEnter) menu.addEventListener('pointerenter', onPointerEnter);
    if (onPointerLeave) menu.addEventListener('pointerleave', onPointerLeave);
    menu.addEventListener('pointerdown', (e) => e.stopPropagation());
    return menu;
  }

  function openNameDialog(doc, { title, initialValue = '', labels, onSubmit, onClose }) {
    const overlay = markOwned(el(doc, 'div', 'ag-prism-part-dialog-backdrop', null, { role: 'dialog', 'aria-modal': 'true' }));
    const card = markOwned(el(doc, 'div', 'ag-prism-part-dialog'));
    const input = el(doc, 'input', 'ag-prism-part-dialog-input');
    input.type = 'text';
    input.placeholder = labels.inputPlaceholder;
    input.maxLength = 60;
    input.value = initialValue;
    const errEl = el(doc, 'div', 'ag-prism-part-dialog-err');
    const actions = el(doc, 'div', 'ag-prism-part-dialog-actions');
    const cancelBtn = el(doc, 'button', 'ag-prism-part-btn', labels.cancel);
    const okBtn = el(doc, 'button', 'ag-prism-part-btn ag-prism-part-btn-primary', labels.confirm);

    const submit = () => {
      const res = onSubmit ? onSubmit(input.value) : { ok: true };
      if (res && res.ok === false) {
        errEl.textContent = res.error || '';
        safe(() => input.focus());
        return;
      }
      onClose();
    };
    cancelBtn.addEventListener('click', onClose);
    okBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    });
    input.addEventListener('input', () => { errEl.textContent = ''; });
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) onClose(); });

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    card.appendChild(el(doc, 'div', 'ag-prism-part-dialog-title', title));
    card.appendChild(input);
    card.appendChild(errEl);
    card.appendChild(actions);
    overlay.appendChild(card);
    doc.body.appendChild(overlay);
    setTimeout(() => safe(() => { input.focus(); input.select(); }), 16);
    return overlay;
  }

  const uiApi = {
    STORAGE_KEY,
    STYLE_ID,
    HIDE_STYLE_ID,
    ROOT_ATTR,
    MAX_VISIBLE_CONVS,
    PARTITIONS_CSS,
    I18N,
    safe,
    fmt,
    cssEsc,
    resolveLang,
    markOwned,
    el,
    makeIcon,
    formatRelativeTime,
    buildRunningDots,
    positionPopup,
    buildPopupMenu,
    openNameDialog,
  };
  G.__agPrismProjectPartitionsUi = uiApi;
  if (typeof window !== 'undefined') window.__agPrismProjectPartitionsUi = uiApi;
  if (typeof module === 'object' && module.exports) module.exports = uiApi;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
