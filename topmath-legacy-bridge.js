/* Top'Math bridge — utilise exclusivement l'ancien moteur enseignant pour conserver données, calculs et PDF. */
(()=>{'use strict';
const iframe=document.querySelector('#legacyTool');
const requested=document.body.dataset.section||'classes';
const status=document.querySelector('#legacyStatus');
const map={classes:'classes',evaluations:'due',tracking:'tracking',open:'open',official:'tracking'};
function info(text){if(status)status.textContent=text}
function frameDocument(){try{return iframe?.contentDocument||null}catch{return null}}
function navigate(){
const doc=frameDocument();if(!doc){info('Impossible d’ouvrir le module enseignant.');return false}
const target=map[requested]||'classes';
const tab=doc.querySelector('[data-tab="'+target+'"]');
if(!tab){info('L’outil historique ne présente pas encore cette section.');return false}
tab.click();
info('Module enseignant chargé : données et fiche officielle d’origine.');
return true;
}
iframe?.addEventListener('load',()=>{navigate()});
document.querySelector('#officialPreview')?.addEventListener('click',()=>{
const doc=frameDocument();
if(!doc||!doc.querySelector('#previewPdf')){info('Ouvrez d’abord le module enseignant.');return}
const btn=doc.querySelector('#previewPdf');btn.click();info('Fiche officielle ouverte dans l’outil historique. Utilisez Télécharger dans la fenêtre PDF.');
});
document.querySelector('#officialTracking')?.addEventListener('click',()=>{const doc=frameDocument();doc?.querySelector('[data-tab="tracking"]')?.click();info('Sélectionnez une classe et un élève pour consulter les passages officiels.')});
})();