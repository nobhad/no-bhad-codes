import{B as m}from"./chunk-DFiJEDgY.js";import{g as i}from"./chunk-DjKJqAo0.js";import{A as n}from"./chunk-CkQA30Fn.js";function u(l){const t=l.querySelectorAll("input[required], select[required], textarea[required]"),e=l.querySelector(".form-button");if(!e)return;let o=!0;t.forEach(r=>{r.value.trim()||(o=!1)}),o?e.classList.add("form-valid"):e.classList.remove("form-valid")}function p(l){l.querySelectorAll("input[required], select[required], textarea[required]").forEach(e=>{e.addEventListener("input",()=>u(l)),e.addEventListener("change",()=>u(l))}),u(l)}class y extends m{constructor(){super("client-landing"),this.contentContainer=null,this.buttonsContainer=null,this.newButton=null,this.existingButton=null,this.titleElement=null}async onInit(){this.cacheElements(),this.setupButtonAnimations(),this.setupButtonHandlers(),this.setupTitleHandler()}onDestroy(){}cacheElements(){this.contentContainer=document.querySelector(".client-content"),this.buttonsContainer=document.querySelector(".client-buttons"),this.newButton=document.querySelector('.client-buttons .btn[href*="intake"]'),this.existingButton=document.querySelector('.client-buttons .btn[href*="portal"]'),this.titleElement=document.querySelector(".login-title")}hideTitle(){this.titleElement&&i.set(this.titleElement,{opacity:0,display:"none"})}showTitle(){this.titleElement&&(i.set(this.titleElement,{display:"block"}),i.to(this.titleElement,{opacity:1,duration:n.TIMERS.ANIMATION_DURATION/1e3,ease:n.EASING.SMOOTH}))}setupTitleHandler(){this.titleElement&&(this.titleElement.style.cursor="pointer",this.titleElement.addEventListener("click",()=>{this.resetToInitialState()}))}resetToInitialState(){const t=this.buttonsContainer?.querySelector(".dynamic-content");t&&i.to(t,{opacity:0,y:20,duration:n.TIMERS.ANIMATION_DURATION/1e3,onComplete:()=>{t.remove()}}),this.setActiveButton(null),this.buttonsContainer?.classList.remove("has-dynamic-content")}setupButtonHandlers(){this.newButton&&this.newButton.addEventListener("click",t=>{t.preventDefault(),this.setActiveButton(this.newButton),this.showIntakeForm()}),this.existingButton&&this.existingButton.addEventListener("click",t=>{t.preventDefault(),this.setActiveButton(this.existingButton),this.showLoginPortal()})}setActiveButton(t){if([this.newButton,this.existingButton].forEach(e=>{if(e){const o=e.querySelector(".button-fill");o&&i.set(o,{width:"0%"}),i.set(e,{color:"inherit"}),e.classList.remove("active")}}),t){const e=t.querySelector(".button-fill");e&&i.set(e,{width:"100%",left:"0",right:"auto",transformOrigin:"left center"}),i.set(t,{color:n.THEME.DARK}),t.classList.add("active")}}showIntakeForm(){const t=this.createIntakeForm();this.showContent(t,"NEW CLIENT INTAKE")}showLoginPortal(){const t=this.createLoginPortal();this.showContent(t,"CLIENT LOGIN")}showContent(t,e){if(!this.buttonsContainer)return;const o=this.buttonsContainer.querySelector(".dynamic-content");o&&o.remove();const r=document.createElement("div");r.className="dynamic-content",r.innerHTML=`
      <div class="content-body">
        ${t}
      </div>
    `,this.buttonsContainer.appendChild(r),this.buttonsContainer.classList.add("has-dynamic-content"),r.addEventListener("click",s=>{s.target===r&&this.closeContent(r)}),i.set(r,{opacity:0,y:20}),i.to(r,{opacity:1,y:0,duration:n.TIMERS.ANIMATION_DURATION/1e3,ease:n.EASING.SMOOTH,onComplete:()=>{const s=r.querySelector("form");s&&p(s)}})}closeContent(t){i.to(t,{opacity:0,y:20,duration:n.TIMERS.ANIMATION_DURATION/1e3,onComplete:()=>{t.remove(),this.setActiveButton(null),this.buttonsContainer?.classList.remove("has-dynamic-content")}})}createIntakeForm(){return`
      <form class="contact-form" id="client-intake-form">
        <h2 style="grid-column: 1 / -1; grid-row: 1; margin: 0; text-align: center; color: var(--fg);">CLIENT INTAKE FORM</h2>
        
        <p class="form-intro" style="grid-column: 1 / -1; grid-row: 2; margin: 0 0 clamp(8px, 2vw, 16px) 0; text-align: center; color: var(--fg);">Please fill out this intake form to get started with your project.</p>
        
        <input class="form-input" type="text" id="company-name" name="company-name" placeholder="Company Name *" required style="grid-column: 1 / -1; grid-row: 3;">
        
        <input class="form-input" type="text" id="first-name" name="first-name" placeholder="First Name *" required style="grid-column: 1 / 2; grid-row: 4;">
        <input class="form-input" type="text" id="last-name" name="last-name" placeholder="Last Name *" required style="grid-column: 2 / 3; grid-row: 4;">
        
        <input class="form-input" type="email" id="email" name="email" placeholder="Email Address *" required style="grid-column: 1 / 2; grid-row: 5;">
        <input class="form-input" type="tel" id="phone" name="phone" placeholder="Phone Number" style="grid-column: 2 / 3; grid-row: 5;">
        
        <select class="form-select" id="project-type" name="project-type" required style="grid-column: 1 / -1; grid-row: 6;">
          <option value="">Project Type *</option>
          <option value="website">Website Development</option>
          <option value="webapp">Web Application</option>
          <option value="ecommerce">E-commerce Platform</option>
          <option value="mobile">Mobile App</option>
          <option value="other">Other</option>
        </select>
        
        <select class="form-select" id="budget" name="budget" style="grid-column: 1 / 2; grid-row: 7;">
          <option value="">Budget Range</option>
          <option value="under-5k">Under $5,000</option>
          <option value="5k-10k">$5,000 - $10,000</option>
          <option value="10k-25k">$10,000 - $25,000</option>
          <option value="25k-50k">$25,000 - $50,000</option>
          <option value="50k-plus">$50,000+</option>
        </select>
        
        <select class="form-select" id="timeline" name="timeline" style="grid-column: 2 / 3; grid-row: 7;">
          <option value="">Desired Timeline</option>
          <option value="asap">ASAP</option>
          <option value="1-2months">1-2 Months</option>
          <option value="3-6months">3-6 Months</option>
          <option value="6months-plus">6+ Months</option>
          <option value="flexible">Flexible</option>
        </select>
        
        <textarea class="form-textarea" id="project-description" name="project-description" placeholder="Project Description - Please describe your project requirements, goals, and any specific features you need..." required style="grid-column: 1 / -1; grid-row: 8;"></textarea>
        
        <textarea class="form-textarea" id="additional-info" name="additional-info" placeholder="Additional Information - Any additional details, questions, or requirements..." style="grid-column: 1 / -1; grid-row: 9;"></textarea>
        
        <div class="form-actions" style="grid-column: 1 / -1; grid-row: 10;">
          <input class="form-button" type="submit" value="Submit Intake Form">
        </div>
      </form>
    `}createLoginPortal(){return`
      <form class="contact-form" id="client-login-form">
        <h2 style="grid-column: 1 / -1; margin: 0; text-align: center; color: var(--fg);">LOGIN</h2>
        
        <input class="form-input" type="email" id="client-email" name="email" placeholder="Email Address *" required style="grid-column: 1 / -1;">
        <div class="error-message" id="email-error" style="grid-column: 1 / -1;"></div>
        
        <div class="password-input-wrapper" style="grid-column: 1 / -1;">
          <input class="form-input" type="password" id="client-password" name="password" placeholder="Password *" required>
          <button type="button" class="password-toggle" aria-label="Toggle password visibility">👁️</button>
        </div>
        
        <input class="form-button" type="submit" value="Access Dashboard" id="login-btn" style="grid-column: 1 / -1; width: 100%; padding: 0.75rem 1.5rem; margin-top: 1rem;">
        <div class="btn-loader" style="display: none; grid-column: 1 / -1;"></div>
        
        <p style="grid-column: 1 / -1; text-align: center; margin: 0.5rem 0; color: var(--fg);">Forgot your password? <button type="button" class="link-btn">Reset Password</button></p>
        
        <p style="grid-column: 1 / -1; text-align: center; margin: 0; color: var(--fg); opacity: 0.8;">Demo credentials: demo@example.com / password123</p>
        
        <div class="error-message" id="login-error" style="grid-column: 1 / -1;"></div>
      </form>
    `}setupButtonAnimations(){document.querySelectorAll(".client-buttons .btn").forEach(e=>{this.animateButton(e)})}animateButton(t){const e=t.textContent?.trim()||"";t.innerHTML=`<span style="position: relative; z-index: 2;">${e}</span>`;const o=document.createElement("div");o.className="button-fill",o.style.cssText=`
      position: absolute;
      top: 0;
      left: 0;
      width: 0%;
      height: 100%;
      background-color: ${n.THEME.PRIMARY};
      z-index: 0;
      pointer-events: none;
      border-radius: inherit;
      transform-origin: left center;
    `,t.appendChild(o),t.addEventListener("mouseenter",r=>{if(t.classList.contains("active"))return;const s=t.getBoundingClientRect(),c=r.clientX,d=s.left+s.width/2,a=c<d;i.set(o,{left:a?"0":"auto",right:a?"auto":"0",transformOrigin:a?"left center":"right center"}),i.to(o,{width:"100%",duration:n.TIMERS.ANIMATION_DURATION/1e3,ease:n.EASING.SMOOTH}),i.to(t,{color:n.THEME.DARK,duration:n.TIMERS.ANIMATION_DURATION/1e3,ease:n.EASING.SMOOTH})}),t.addEventListener("mouseleave",r=>{if(t.classList.contains("active"))return;const s=t.getBoundingClientRect(),c=r.clientX,d=s.left+s.width/2,a=c<d;i.set(o,{left:a?"0":"auto",right:a?"auto":"0",transformOrigin:a?"left center":"right center"}),i.to(o,{width:"0%",duration:n.TIMERS.ANIMATION_DURATION/1e3,ease:n.EASING.SMOOTH}),i.to(t,{color:"inherit",duration:n.TIMERS.ANIMATION_DURATION/1e3,ease:n.EASING.SMOOTH})})}}export{y as ClientLandingModule};
