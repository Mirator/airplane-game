// core.js - storage keys, DOM handles and the shared mutable state that every other module reads/writes.

const RUN_KEY='dcr_run_v2',OLD_RUN_KEYS=['dcr_run_v1'],SAVE_VER=3,RUN_VERS=[2,3],META_KEY='dcr_meta_v1',IDB_NAME='dcr_run_mirror';
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const $=id=>document.getElementById(id);
let noticeOld=false,G=null,fx=[],flashUntil=0,rafPending=false,view={ts:40,ox:0,oy:0,cw:300,ch:300,dpr:1},walkTok=0,dest=null,tapMark=null,bigMap=false,armed=null,inChain=false;
let AC=null,flashes={},shakeUntil=0,shakeAmt=0,puffs=[],pulseUntil=0,stepAnim=null,lastPos=null,visX=0,visY=0;
let shrineQ=false,trapConfirm=-1,bannerText='',bannerUntil=0,wsc={arr:null,set:new Set()},toastQ=[],toastBusy=false,chipHtml='';
let gearQ=null,insp=null,lp=null,lpAt=-1e9,lpDone=false,guard=null,hpLow=false,hpLowG=null,eliteSeen=new Set(),eliteG=null;
let claimed=new Set(),goneT=new Map(),lastAtk=null,frameT=null,modalAt=0,lastDown=0,modalGrace=0;
let LOGN=3;   // message-log lines shown (3 in the bottom bar layout, more in the wide side panel)
