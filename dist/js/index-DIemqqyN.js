import{B as y}from"./chunk-DFiJEDgY.js";import{a as w,c as v}from"./chunk-Dmuk_T3B.js";import{P as x,A as _}from"./chunk-C20AiJlz.js";import"./index-DIemqqyN.js";class f extends y{constructor(t,e,n,s={}){super(t,s),this.template=null,this.shadowRoot=null,this.host=null,this.refs=new Map,this.stateUnsubscribe=null,this.propWatchers=new Map,this.stateWatchers=new Map,this.props={...e},this.state={...n}}async mount(t){if(typeof t=="string"?this.host=document.querySelector(t):this.host=t,!this.host)throw new Error("Cannot mount component: host element not found");await this.beforeMount?.(),await this.render(),await this.mounted?.(),this.subscribeToGlobalState(),this.log("Component mounted successfully")}async updateProps(t){const e={...this.props};this.props={...this.props,...t},Object.keys(t).forEach(n=>{(this.propWatchers.get(n)||[]).forEach(o=>o(t[n],e[n]))}),await this.beforeUpdate?.(e,this.state),await this.render(),await this.updated?.(e,this.state)}async setState(t){const e={...this.state};this.state={...this.state,...t},Object.keys(t).forEach(n=>{(this.stateWatchers.get(n)||[]).forEach(o=>o(t[n],e[n]))}),await this.beforeUpdate?.(this.props,e),await this.render(),await this.updated?.(this.props,e)}watchProp(t,e){const n=this.propWatchers.get(t)||[];return n.push(e),this.propWatchers.set(t,n),()=>{const s=this.propWatchers.get(t)||[],o=s.indexOf(e);o>-1&&s.splice(o,1)}}watchState(t,e){const n=this.stateWatchers.get(t)||[];return n.push(e),this.stateWatchers.set(t,n),()=>{const s=this.stateWatchers.get(t)||[],o=s.indexOf(e);o>-1&&s.splice(o,1)}}createRef(t){return e=>{e?this.refs.set(t,e):this.refs.delete(t)}}getRef(t){return this.refs.get(t)||null}subscribeToGlobalState(){this.onGlobalStateChange&&(this.stateUnsubscribe=w.subscribe((t,e)=>{this.onGlobalStateChange(t,e)}))}async render(){if(!this.host||!this.template)return;const t=this.template.render(),e=this.template.css?.()||"";e&&!this.shadowRoot&&!this.host.shadowRoot?this.shadowRoot=this.host.attachShadow({mode:"open"}):this.host.shadowRoot&&(this.shadowRoot=this.host.shadowRoot);const n=this.shadowRoot||this.host;this.shadowRoot&&e?n.innerHTML=`<style>${e}</style>${t}`:n.innerHTML=t,this.cacheElements(),this.bindEvents()}cacheElements(){}bindEvents(){}async destroy(){await this.beforeUnmount?.(),this.propWatchers.clear(),this.stateWatchers.clear(),this.refs.clear(),this.stateUnsubscribe&&(this.stateUnsubscribe(),this.stateUnsubscribe=null),this.host&&this.host.parentNode&&this.host.parentNode.removeChild(this.host),await super.destroy(),await this.unmounted?.()}getComponentInfo(){return{...this.getStatus(),props:this.props,state:this.state,refsCount:this.refs.size,propWatchersCount:Array.from(this.propWatchers.values()).reduce((t,e)=>t+e.length,0),stateWatchersCount:Array.from(this.stateWatchers.values()).reduce((t,e)=>t+e.length,0),hasShadowRoot:!!this.shadowRoot,isMounted:!!this.host}}}class k{constructor(){this.components=new Map,this.definitions=new Map,this.idCounter=0}register(t){this.definitions.set(t.name,t),v.register(t.name,t.factory,{singleton:t.singleton??!1,dependencies:[]})}async create(t,e={},n){const s=this.definitions.get(t);if(!s)throw new Error(`Component '${t}' not registered`);const o=`${t}-${++this.idCounter}`,a=await s.factory(e),r={id:o,component:a,mounted:!1,props:{...e},element:n};return this.components.set(o,r),n&&(await a.mount(n),r.mounted=!0),a}findByName(t){return Array.from(this.components.values()).filter(e=>e.component.constructor.name.includes(t))}getInstance(t){return this.components.get(t)||null}async updateProps(t,e){const n=this.components.get(t);if(!n)throw new Error(`Component instance '${t}' not found`);n.props={...n.props,...e},await n.component.updateProps(e)}async destroy(t){const e=this.components.get(t);e&&(await e.component.destroy(),this.components.delete(t))}async destroyByName(t){const e=this.findByName(t);await Promise.all(e.map(n=>this.destroy(n.id)))}async destroyAll(){const t=Array.from(this.components.keys()).map(e=>this.destroy(e));await Promise.all(t)}getAllInstances(){return Array.from(this.components.values())}getRegistryInfo(){return{registeredComponents:Array.from(this.definitions.keys()),totalInstances:this.components.size,mountedInstances:Array.from(this.components.values()).filter(t=>t.mounted).length,instances:Array.from(this.components.entries()).map(([t,e])=>({id:t,name:e.component.constructor.name,mounted:e.mounted,status:e.component.getStatus()}))}}broadcast(t,e={}){this.components.forEach(n=>{const s=new CustomEvent(`component:${t}`,{detail:{data:e,sourceId:"store"}});n.element?n.element.dispatchEvent(s):document.dispatchEvent(s)})}send(t,e,n={}){const s=this.components.get(t);if(s){const o=new CustomEvent(`component:${e}`,{detail:{data:n,sourceId:"store",targetId:t}});s.element?s.element.dispatchEvent(o):document.dispatchEvent(o)}}}class l{static html(t,...e){return t.reduce((n,s,o)=>n+s+(e[o]||""),"")}static css(t,...e){return t.reduce((n,s,o)=>n+s+(e[o]||""),"")}static sanitizeHTML(t){const e=document.createElement("div");return e.textContent=t,e.innerHTML}static debounce(t,e){let n;return(...s)=>{clearTimeout(n),n=setTimeout(()=>t.apply(this,s),e)}}static throttle(t,e){let n;return(...s)=>{n||(t.apply(this,s),n=!0,setTimeout(()=>n=!1,e))}}static parseDataAttributes(t,e="data-"){const n={};return Array.from(t.attributes).forEach(s=>{if(s.name.startsWith(e)){const o=s.name.slice(e.length).replace(/-([a-z])/g,(r,d)=>d.toUpperCase());let a=s.value;try{a=JSON.parse(s.value)}catch{s.value==="true"?a=!0:s.value==="false"?a=!1:isNaN(Number(s.value))||(a=Number(s.value))}n[o]=a}}),n}static generateId(t="component"){return`${t}-${Math.random().toString(36).substr(2,9)}`}static isInViewport(t){const e=t.getBoundingClientRect();return e.top>=0&&e.left>=0&&e.bottom<=(window.innerHeight||document.documentElement.clientHeight)&&e.right<=(window.innerWidth||document.documentElement.clientWidth)}}const c=new k;class E extends f{constructor(t){const e={pressed:!1,focused:!1};super("ButtonComponent",t,e,{debug:!0}),this.handleClick=n=>{if(this.props.disabled||this.props.loading){n.preventDefault();return}this.props.onClick?.(n),this.dispatchEvent("click",{originalEvent:n})},this.handleMouseDown=()=>{this.setState({pressed:!0})},this.handleMouseUp=()=>{this.setState({pressed:!1})},this.handleFocus=()=>{this.setState({focused:!0})},this.handleBlur=()=>{this.setState({focused:!1,pressed:!1})},this.handleKeyDown=n=>{if(n.key===" "||n.key==="Enter"){n.preventDefault(),this.setState({pressed:!0});const s=()=>{this.setState({pressed:!1}),this.handleClick(n),window.removeEventListener("keyup",s)};window.addEventListener("keyup",s)}},this.template={render:()=>this.renderTemplate(),css:()=>this.getStyles()}}renderTemplate(){const{variant:t="primary",size:e="medium",disabled:n=!1,loading:s=!1,icon:o,iconPosition:a="left",fullWidth:r=!1,children:d="Button",ariaLabel:h,type:u="button"}=this.props,m=["btn",`btn--${t}`,`btn--${e}`,n&&"btn--disabled",s&&"btn--loading",r&&"btn--full-width",this.state.pressed&&"btn--pressed",this.state.focused&&"btn--focused"].filter(Boolean).join(" "),b=o?`<span class="btn__icon btn__icon--${a}">${o}</span>`:"",g=s?'<span class="btn__spinner"></span>':"";return l.html`
      <button
        type="${u}"
        class="${m}"
        ${n?"disabled":""}
        ${h?`aria-label="${h}"`:""}
        aria-pressed="${this.state.pressed}"
        data-ref="button"
      >
        ${s?g:""}
        ${a==="left"?b:""}
        <span class="btn__text">${l.sanitizeHTML(d)}</span>
        ${a==="right"?b:""}
      </button>
    `}getStyles(){return l.css`
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        border: 1px solid transparent;
        border-radius: 6px;
        font-family: inherit;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
        user-select: none;
      }

      .btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .btn--small {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        min-height: 2rem;
      }

      .btn--medium {
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        min-height: 2.5rem;
      }

      .btn--large {
        padding: 1rem 2rem;
        font-size: 1.125rem;
        min-height: 3rem;
      }

      .btn--primary {
        background: var(--color-primary, #ff6b6b);
        color: white;
        border-color: var(--color-primary, #ff6b6b);
      }

      .btn--primary:hover:not(:disabled) {
        background: var(--color-primary-dark, #e55a5a);
        border-color: var(--color-primary-dark, #e55a5a);
        transform: translateY(-1px);
      }

      .btn--secondary {
        background: var(--color-secondary, #6c757d);
        color: white;
        border-color: var(--color-secondary, #6c757d);
      }

      .btn--secondary:hover:not(:disabled) {
        background: var(--color-secondary-dark, #5a6268);
        transform: translateY(-1px);
      }

      .btn--ghost {
        background: transparent;
        color: var(--color-text, #333);
        border-color: var(--color-border, #ddd);
      }

      .btn--ghost:hover:not(:disabled) {
        background: var(--color-background-hover, #f8f9fa);
        border-color: var(--color-primary, #ff6b6b);
      }

      .btn--danger {
        background: var(--color-danger, #dc3545);
        color: white;
        border-color: var(--color-danger, #dc3545);
      }

      .btn--danger:hover:not(:disabled) {
        background: var(--color-danger-dark, #c82333);
        transform: translateY(-1px);
      }

      .btn--full-width {
        width: 100%;
      }

      .btn--disabled {
        opacity: 0.6;
        cursor: not-allowed;
        pointer-events: none;
      }

      .btn--loading {
        cursor: wait;
        pointer-events: none;
      }

      .btn--pressed {
        transform: translateY(1px);
      }

      .btn--focused {
        box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.2);
      }

      .btn__icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .btn__text {
        flex: 1;
      }

      .btn__spinner {
        display: inline-block;
        width: 1em;
        height: 1em;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: btn-spin 1s linear infinite;
        margin-right: 0.5rem;
      }

      @keyframes btn-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (prefers-reduced-motion: reduce) {
        .btn {
          transition: none;
        }
        .btn__spinner {
          animation: none;
        }
        .btn:hover:not(:disabled) {
          transform: none;
        }
      }
    `}cacheElements(){this.getElement("button",'[data-ref="button"]')}bindEvents(){const t=this.getElement("button",'[data-ref="button"]');t&&(this.addEventListener(t,"click",this.handleClick.bind(this)),this.addEventListener(t,"mousedown",this.handleMouseDown.bind(this)),this.addEventListener(t,"mouseup",this.handleMouseUp.bind(this)),this.addEventListener(t,"focus",this.handleFocus.bind(this)),this.addEventListener(t,"blur",this.handleBlur.bind(this)),this.addEventListener(t,"keydown",this.handleKeyDown.bind(this)))}setLoading(t){this.updateProps({loading:t})}setDisabled(t){this.updateProps({disabled:t})}focus(){this.getElement("button",'[data-ref="button"]')?.focus()}blur(){this.getElement("button",'[data-ref="button"]')?.blur()}}class C extends f{constructor(t){const e={isOpen:!1,isAnimating:!1};super("ModalComponent",t,e,{debug:!0}),this.previousFocusedElement=null,this.focusableElements=[],this.handleBackdropClick=n=>{n.target===n.currentTarget&&this.close()},this.handleClose=()=>{this.close()},this.handleKeydown=n=>{if(this.state.isOpen)switch(n.key){case"Escape":this.props.closeOnEscape&&(n.preventDefault(),this.close());break;case"Tab":this.handleTabKey(n);break}},this.template={render:()=>this.renderTemplate(),css:()=>this.getStyles()}}renderTemplate(){const{title:t="Modal",size:e="medium",closable:n=!0,showHeader:s=!0,showFooter:o=!1,headerContent:a="",footerContent:r="",children:d="",zIndex:h=1e3}=this.props,{isOpen:u,isAnimating:m}=this.state;if(!u&&!m)return"";const b=["modal",`modal--${e}`,u&&"modal--open",m&&"modal--animating"].filter(Boolean).join(" ");return l.html`
      <div class="modal-backdrop" style="z-index: ${h}" data-ref="backdrop">
        <div 
          class="${b}"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          data-ref="modal"
        >
          ${s?`
            <div class="modal__header" data-ref="header">
              <h2 id="modal-title" class="modal__title">${l.sanitizeHTML(t)}</h2>
              ${n?`
                <button 
                  class="modal__close" 
                  aria-label="Close modal"
                  data-ref="closeButton"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              `:""}
              ${a?`<div class="modal__header-content">${a}</div>`:""}
            </div>
          `:""}
          
          <div class="modal__body" data-ref="body">
            ${d}
          </div>
          
          ${o?`
            <div class="modal__footer" data-ref="footer">
              ${r}
            </div>
          `:""}
        </div>
      </div>
    `}getStyles(){return l.css`
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        padding: 1rem;
        box-sizing: border-box;
      }

      .modal-backdrop--open {
        opacity: 1;
        visibility: visible;
      }

      .modal {
        background: var(--color-background, white);
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        max-width: 100%;
        max-height: 100%;
        display: flex;
        flex-direction: column;
        transform: scale(0.9) translateY(-20px);
        transition: transform 0.3s ease;
        position: relative;
      }

      .modal--open {
        transform: scale(1) translateY(0);
      }

      .modal--small {
        width: 400px;
      }

      .modal--medium {
        width: 600px;
      }

      .modal--large {
        width: 800px;
      }

      .modal--fullscreen {
        width: 100%;
        height: 100%;
        border-radius: 0;
      }

      .modal__header {
        padding: 1.5rem;
        border-bottom: 1px solid var(--color-border, #e5e5e5);
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }

      .modal__title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text, #333);
      }

      .modal__close {
        background: none;
        border: none;
        padding: 0.5rem;
        cursor: pointer;
        color: var(--color-text-secondary, #666);
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      .modal__close:hover {
        background: var(--color-background-hover, #f5f5f5);
      }

      .modal__close:focus {
        outline: 2px solid var(--color-primary, #ff6b6b);
        outline-offset: 2px;
      }

      .modal__header-content {
        margin-left: auto;
        margin-right: 0.5rem;
      }

      .modal__body {
        padding: 1.5rem;
        flex: 1;
        overflow-y: auto;
        color: var(--color-text, #333);
      }

      .modal__footer {
        padding: 1.5rem;
        border-top: 1px solid var(--color-border, #e5e5e5);
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        flex-shrink: 0;
      }

      @media (max-width: 768px) {
        .modal--small,
        .modal--medium,
        .modal--large {
          width: 100%;
          height: 100%;
          border-radius: 0;
        }
        
        .modal-backdrop {
          padding: 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .modal-backdrop,
        .modal {
          transition: none;
        }
      }
    `}cacheElements(){this.getElement("backdrop",'[data-ref="backdrop"]'),this.getElement("modal",'[data-ref="modal"]'),this.getElement("closeButton",'[data-ref="closeButton"]',!1),this.getElement("body",'[data-ref="body"]')}bindEvents(){const t=this.getElement("backdrop",'[data-ref="backdrop"]'),e=this.getElement("closeButton",'[data-ref="closeButton"]',!1);t&&this.props.closeOnBackdrop&&this.addEventListener(t,"click",n=>this.handleBackdropClick(n)),e&&this.addEventListener(e,"click",this.handleClose.bind(this)),this.props.closeOnEscape&&this.addEventListener(document,"keydown",n=>this.handleKeydown(n))}handleTabKey(t){if(this.focusableElements.length===0)return;const e=this.focusableElements[0],n=this.focusableElements[this.focusableElements.length-1];t.shiftKey?document.activeElement===e&&(t.preventDefault(),n?.focus()):document.activeElement===n&&(t.preventDefault(),e?.focus())}updateFocusableElements(){const t=this.getElement("modal",'[data-ref="modal"]');if(!t)return;const e=["button:not([disabled])","input:not([disabled])","select:not([disabled])","textarea:not([disabled])","a[href]",'[tabindex]:not([tabindex="-1"])'];this.focusableElements=Array.from(t.querySelectorAll(e.join(",")))}async open(){if(this.state.isOpen||this.state.isAnimating)return;this.previousFocusedElement=document.activeElement,await this.setState({isOpen:!0,isAnimating:!0});const t=this.getElement("backdrop",'[data-ref="backdrop"]');t&&t.classList.add("modal-backdrop--open"),setTimeout(()=>{this.updateFocusableElements(),this.focusableElements.length>0&&this.focusableElements[0]?.focus(),this.setState({isAnimating:!1}),this.props.onOpen?.()},100),document.body.style.overflow="hidden",this.dispatchEvent("open")}async close(){if(!this.state.isOpen||this.state.isAnimating)return;await this.setState({isAnimating:!0});const t=this.getElement("backdrop",'[data-ref="backdrop"]');t&&t.classList.remove("modal-backdrop--open"),setTimeout(async()=>{await this.setState({isOpen:!1,isAnimating:!1}),this.previousFocusedElement&&(this.previousFocusedElement.focus(),this.previousFocusedElement=null),document.body.style.overflow="",this.props.onClose?.(),this.dispatchEvent("close")},300)}toggle(){this.state.isOpen?this.close():this.open()}setContent(t){this.updateProps({children:t})}isOpen(){return this.state.isOpen}}class p extends f{constructor(t){const e={isVisible:!p.hasExistingConsent(),showDetails:!1,hasResponded:p.hasExistingConsent()};super("ConsentBanner",t,e,{debug:!0}),this.hideTimer=null,this.handleAccept=()=>{this.setConsent("accepted"),this.hide(),this.props.onAccept?.(),this.dispatchEvent("consent-accepted")},this.handleDecline=()=>{this.setConsent("declined"),this.hide(),this.props.onDecline?.(),this.dispatchEvent("consent-declined")},this.handleToggleDetails=()=>{this.setState({showDetails:!this.state.showDetails}),this.props.onDetailsClick?.()},this.template={render:()=>this.renderTemplate(),css:()=>this.getStyles()}}static hasExistingConsent(){return document.cookie.includes("tracking_consent=")}static getConsentStatus(){const t=document.cookie.match(/tracking_consent=([^;]+)/);return t?t[1]:null}async mounted(){if(this.props.autoHide&&this.state.isVisible){const t=this.props.hideDelay||1e4;this.hideTimer=setTimeout(()=>{this.handleDecline()},t)}}renderTemplate(){const{position:t="bottom",theme:e="light",showDetailsLink:n=!0,companyName:s="This website",privacyPolicyUrl:o}=this.props,{isVisible:a,showDetails:r}=this.state;if(!a)return"";const d=`consent-banner--${t}`,h=`consent-banner--${e}`;return l.html`
      <div class="consent-banner ${d} ${h}" data-ref="banner">
        <div class="consent-banner__content">
          <div class="consent-banner__icon">
            🍪
          </div>
          
          <div class="consent-banner__text">
            <h3 class="consent-banner__title">We respect your privacy</h3>
            <p class="consent-banner__message">
              ${s} uses cookies and similar technologies to enhance your browsing experience, 
              analyze site traffic, and understand visitor behavior. Your privacy is important to us.
            </p>
            
            ${r?this.renderDetails():""}
          </div>
          
          <div class="consent-banner__actions">
            <div class="consent-banner__buttons">
              <button 
                class="consent-banner__btn consent-banner__btn--secondary" 
                data-ref="declineBtn"
              >
                Decline
              </button>
              <button 
                class="consent-banner__btn consent-banner__btn--primary" 
                data-ref="acceptBtn"
              >
                Accept All
              </button>
            </div>
            
            ${n?`
              <div class="consent-banner__links">
                <button 
                  class="consent-banner__link" 
                  data-ref="detailsBtn"
                >
                  ${r?"Hide Details":"Learn More"}
                </button>
                ${o?`
                  <a 
                    href="${o}" 
                    class="consent-banner__link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>
                `:""}
              </div>
            `:""}
          </div>
        </div>
      </div>
    `}renderDetails(){return l.html`
      <div class="consent-banner__details">
        <h4>What we track:</h4>
        <ul>
          <li><strong>Page Views:</strong> Which pages you visit and how long you stay</li>
          <li><strong>Interactions:</strong> Buttons you click and forms you use</li>
          <li><strong>Performance:</strong> How fast our site loads for you</li>
          <li><strong>Technical Info:</strong> Your browser type and screen size</li>
        </ul>
        
        <h4>What we don't track:</h4>
        <ul>
          <li>Personal information without consent</li>
          <li>Your identity across other websites</li>
          <li>Sensitive personal data</li>
        </ul>
        
        <p class="consent-banner__note">
          You can change your mind anytime by clearing your browser cookies or 
          contacting us. Declining won't affect your ability to use our website.
        </p>
      </div>
    `}getStyles(){return l.css`
      .consent-banner {
        position: fixed;
        left: 0;
        right: 0;
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 0, 0, 0.1);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.3s ease-out;
        max-width: 100%;
        padding: 0 20px;
        box-sizing: border-box;
      }

      .consent-banner--top {
        top: 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0 0 12px 12px;
      }

      .consent-banner--bottom {
        bottom: 0;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 12px 12px 0 0;
      }

      .consent-banner--dark {
        background: rgba(33, 33, 33, 0.98);
        border-color: rgba(255, 255, 255, 0.1);
        color: white;
      }

      .consent-banner--dark .consent-banner__btn--secondary {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border-color: rgba(255, 255, 255, 0.2);
      }

      .consent-banner__content {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px 0;
      }

      .consent-banner__icon {
        font-size: 24px;
        flex-shrink: 0;
        margin-top: 4px;
      }

      .consent-banner__text {
        flex: 1;
        min-width: 0;
      }

      .consent-banner__title {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: inherit;
      }

      .consent-banner__message {
        margin: 0 0 16px 0;
        font-size: 14px;
        line-height: 1.5;
        color: inherit;
        opacity: 0.8;
      }

      .consent-banner__details {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 8px;
        padding: 16px;
        margin-top: 12px;
        font-size: 13px;
        line-height: 1.4;
      }

      .consent-banner--dark .consent-banner__details {
        background: rgba(255, 255, 255, 0.05);
      }

      .consent-banner__details h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
      }

      .consent-banner__details ul {
        margin: 0 0 12px 16px;
        padding: 0;
      }

      .consent-banner__details li {
        margin-bottom: 4px;
      }

      .consent-banner__note {
        margin: 12px 0 0 0;
        font-style: italic;
        opacity: 0.7;
      }

      .consent-banner__actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex-shrink: 0;
      }

      .consent-banner__buttons {
        display: flex;
        gap: 8px;
      }

      .consent-banner__btn {
        padding: 10px 20px;
        border: 1px solid transparent;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .consent-banner__btn--primary {
        background: #2563eb;
        color: white;
        border-color: #2563eb;
      }

      .consent-banner__btn--primary:hover {
        background: #1d4ed8;
        border-color: #1d4ed8;
      }

      .consent-banner__btn--secondary {
        background: transparent;
        color: #374151;
        border-color: #d1d5db;
      }

      .consent-banner__btn--secondary:hover {
        background: #f9fafb;
        border-color: #9ca3af;
      }

      .consent-banner__links {
        display: flex;
        gap: 16px;
        align-items: center;
      }

      .consent-banner__link {
        background: none;
        border: none;
        color: #333;
        font-size: 13px;
        text-decoration: underline;
        cursor: pointer;
        transition: opacity 0.2s ease;
        padding: 0;
      }

      .consent-banner__link:hover {
        opacity: 0.7;
      }

      .consent-banner--dark .consent-banner__link {
        color: #ccc;
      }

      @keyframes slideIn {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .consent-banner--top {
        animation-name: slideInTop;
      }

      @keyframes slideInTop {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @media (max-width: 768px) {
        .consent-banner {
          padding: 0 16px;
        }

        .consent-banner__content {
          flex-direction: column;
          gap: 12px;
        }

        .consent-banner__actions {
          width: 100%;
        }

        .consent-banner__buttons {
          flex-direction: column;
          width: 100%;
        }

        .consent-banner__btn {
          width: 100%;
        }

        .consent-banner__links {
          justify-content: center;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .consent-banner {
          animation: none;
        }
      }
    `}cacheElements(){const t=this.shadowRoot||this.host||document,e=t.querySelector('[data-ref="banner"]');e&&this.elements.set("banner",e);const n=t.querySelector('[data-ref="acceptBtn"]');n&&this.elements.set("acceptBtn",n);const s=t.querySelector('[data-ref="declineBtn"]');s&&this.elements.set("declineBtn",s);const o=t.querySelector('[data-ref="detailsBtn"]');o&&this.elements.set("detailsBtn",o)}bindEvents(){const t=this.getElement("acceptBtn",'[data-ref="acceptBtn"]',!1),e=this.getElement("declineBtn",'[data-ref="declineBtn"]',!1),n=this.getElement("detailsBtn",'[data-ref="detailsBtn"]',!1);t&&this.addEventListener(t,"click",this.handleAccept.bind(this)),e&&this.addEventListener(e,"click",this.handleDecline.bind(this)),n&&this.addEventListener(n,"click",this.handleToggleDetails.bind(this))}setConsent(t){const e=new Date;e.setFullYear(e.getFullYear()+1),document.cookie=`tracking_consent=${t}; expires=${e.toUTCString()}; path=/; SameSite=Strict`,this.setState({hasResponded:!0})}hide(){this.hideTimer&&(clearTimeout(this.hideTimer),this.hideTimer=null),this.setState({isVisible:!1}),setTimeout(()=>{const t=this.getElement("banner",'[data-ref="banner"]');t&&(t.style.animation="slideOut 0.3s ease-in forwards")},100)}show(){this.setState({isVisible:!0,hasResponded:!1})}reset(){document.cookie="tracking_consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;",this.setState({isVisible:!0,hasResponded:!1,showDetails:!1})}getConsentStatus(){return p.getConsentStatus()}async destroy(){this.hideTimer&&(clearTimeout(this.hideTimer),this.hideTimer=null),await super.destroy()}}c.register({name:"Button",factory:async i=>new E(i),singleton:!1,lazy:!1});c.register({name:"Modal",factory:async i=>new C(i),singleton:!1,lazy:!1});c.register({name:"PerformanceDashboard",factory:async i=>new x(i),singleton:!0,lazy:!1});c.register({name:"ConsentBanner",factory:async i=>new p(i),singleton:!0,lazy:!1});c.register({name:"AnalyticsDashboard",factory:async i=>new _(i),singleton:!0,lazy:!1});const D=(i={},t)=>c.create("ConsentBanner",i,t);class A{static autoInit(t=document.body){const e=t.querySelectorAll("[data-component]"),n=[];return e.forEach(async s=>{const o=s.getAttribute("data-component");if(!o)return;const a=l.parseDataAttributes(s,"data-prop-");try{await c.create(o,a,s),n.push(Promise.resolve())}catch(r){console.error(`Failed to auto-initialize component ${o}:`,r)}}),Promise.all(n)}static async fromConfig(t){const e=[];for(const n of t)try{const s=await c.create(n.component,n.props,n.target);e.push(s)}catch(s){console.error("Failed to create component from config:",s)}return e}static async updateComponentsByType(t,e){const n=c.findByName(t);await Promise.all(n.map(s=>c.updateProps(s.id,e)))}static getStats(){const t=c.getRegistryInfo();return{...t,memoryUsage:{totalInstances:t.totalInstances,mountedInstances:t.mountedInstances,unmountedInstances:t.totalInstances-t.mountedInstances},performance:{averageInitTime:0,errorRate:0}}}}export{_ as AnalyticsDashboard,f as BaseComponent,E as ButtonComponent,A as ComponentRegistry,l as ComponentUtils,p as ConsentBanner,C as ModalComponent,x as PerformanceDashboard,c as componentStore,D as createConsentBanner};
