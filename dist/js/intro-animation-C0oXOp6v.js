import{B as l}from"./chunk-DFiJEDgY.js";import{g as a}from"./chunk-DjKJqAo0.js";class m extends l{constructor(e={}){super("IntroAnimationModule",{debug:!1,...e}),this.overlay=null,this.introCard=null,this.cardInner=null,this.frontFace=null,this.backFace=null,this.timeline=null,this.isComplete=!1,this.skipHandler=null,this.handleSkip=this.handleSkip.bind(this),this.handleKeyPress=this.handleKeyPress.bind(this)}async init(){await super.init();try{this.createIntroElements(),this.setupEventListeners(),this.startAnimation()}catch(e){this.error("Failed to initialize intro animation:",e),this.completeIntro()}}createIntroElements(){const e=document.querySelector(".business-card-container");this.overlay=document.createElement("div"),this.overlay.id="intro-overlay",this.overlay.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: var(--color-neutral-300, #f5f5f5);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `,this.introCard=document.createElement("div"),this.introCard.id="intro-card-container";let i=525,s=299.7;const n={top:0,left:0};if(e){const t=e.getBoundingClientRect(),d=window.getComputedStyle(e);i=parseInt(d.width)||t.width,s=parseInt(d.height)||t.height,n.top=t.top+t.height/2-window.innerHeight/2,n.left=t.left+t.width/2-window.innerWidth/2}else{const t=window.innerWidth;t<=480?(i=350,s=199.8):t<=768&&(i=420,s=239.9)}this.introCard.style.cssText=`
      width: ${i}px;
      height: ${s}px;
      perspective: 1000px;
      position: relative;
      transform: translate(${n.left}px, ${n.top}px);
    `,this.cardInner=document.createElement("div"),this.cardInner.id="intro-card-inner",this.cardInner.style.cssText=`
      width: 100%;
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.6s ease-in-out;
    `,this.frontFace=document.createElement("div"),this.frontFace.classList.add("intro-card-face","intro-card-front"),this.frontFace.style.cssText=`
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      transform: rotateY(0deg);
      border-radius: 0;
      overflow: hidden;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      color: #333333;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    `,this.backFace=document.createElement("div"),this.backFace.classList.add("intro-card-face","intro-card-back"),this.backFace.style.cssText=`
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      transform: rotateY(180deg);
      border-radius: 0;
      overflow: hidden;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      color: #333333;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    `;const r=document.createElement("img");r.src="/images/business-card_front.svg",r.alt="Business Card Front",r.style.cssText=`
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    `;const o=document.createElement("img");o.src="/images/business-card_back.svg",o.alt="Business Card Back",o.style.cssText=`
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    `,this.frontFace.appendChild(r),this.backFace.appendChild(o),this.cardInner.appendChild(this.frontFace),this.cardInner.appendChild(this.backFace),this.introCard.appendChild(this.cardInner),this.overlay.appendChild(this.introCard),document.body.appendChild(this.overlay)}setupEventListeners(){this.skipHandler=this.handleKeyPress,document.addEventListener("keydown",this.skipHandler)}handleKeyPress(e){e.key==="Enter"&&!this.isComplete&&this.handleSkip()}handleSkip(){this.timeline&&!this.isComplete?this.timeline.progress(1):this.isComplete||this.completeIntro()}startAnimation(){if(!this.cardInner||!this.overlay){this.error("Missing elements for animation");return}this.timeline=a.timeline({onComplete:()=>this.completeIntro()}),a.set(this.cardInner,{rotationY:180}),a.set(this.overlay,{opacity:1}),this.timeline.to({},{duration:1.2}).to(this.cardInner,{rotationY:0,duration:.8,ease:"power2.inOut"}).to({},{duration:.5}).to(this.overlay,{opacity:0,duration:.8,ease:"power2.inOut",onStart:()=>{document.documentElement.classList.remove("intro-loading"),document.documentElement.classList.add("intro-complete")}}).to(this.introCard,{opacity:0,scale:.9,duration:.4,ease:"power2.inOut"})}completeIntro(){this.isComplete=!0,document.documentElement.classList.remove("intro-loading"),document.documentElement.classList.add("intro-complete"),this.overlay&&this.overlay.parentNode&&this.overlay.parentNode.removeChild(this.overlay),this.skipHandler&&(document.removeEventListener("keydown",this.skipHandler),this.skipHandler=null)}getStatus(){return{...super.getStatus(),isComplete:this.isComplete,hasOverlay:!!this.overlay,timelineProgress:this.timeline?.progress()||0}}async destroy(){this.timeline&&(this.timeline.kill(),this.timeline=null),this.overlay&&this.overlay.parentNode&&this.overlay.parentNode.removeChild(this.overlay),this.skipHandler&&(document.removeEventListener("keydown",this.skipHandler),this.skipHandler=null),await super.destroy()}}export{m as IntroAnimationModule};
