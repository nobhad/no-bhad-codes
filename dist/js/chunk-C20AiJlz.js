import{BaseComponent as p,ComponentUtils as i}from"./index-DIemqqyN.js";import{c as h}from"./chunk-Dmuk_T3B.js";class v extends p{constructor(e){const t={isMinimized:e.minimized||!1,metrics:{},alerts:[],score:100,isVisible:!0};super("PerformanceDashboard",e,t,{debug:!0}),this.performanceService=null,this.updateTimer=null,this.template={render:()=>this.renderTemplate(),css:()=>this.getStyles()}}async mounted(){this.performanceService=await h.resolve("PerformanceService"),this.startMetricsUpdate(),this.props.autoHide&&setTimeout(()=>{this.setState({isVisible:!1})},1e4)}startMetricsUpdate(){const e=this.props.updateInterval||2e3;if(this.updateTimer=setInterval(()=>{if(this.performanceService){const t=this.performanceService.generateReport();this.setState({metrics:t.metrics,alerts:t.alerts,score:t.score})}},e),this.performanceService){const t=this.performanceService.generateReport();this.setState({metrics:t.metrics,alerts:t.alerts,score:t.score})}}renderTemplate(){const{position:e="top-right",showAlerts:t=!0,showRecommendations:a=!0}=this.props,{isMinimized:s,isVisible:r,metrics:o,alerts:n,score:d}=this.state;if(!r)return"";const l=`perf-dashboard--${e}`,c=s?"perf-dashboard--minimized":"";return i.html`
      <div class="perf-dashboard ${l} ${c}" data-ref="dashboard">
        <div class="perf-dashboard__header" data-ref="header">
          <div class="perf-dashboard__title">
            <span class="perf-dashboard__score perf-dashboard__score--${this.getScoreClass(d)}">
              ${Math.round(d)}
            </span>
            <span>Performance</span>
          </div>
          <div class="perf-dashboard__controls">
            <button 
              class="perf-dashboard__btn" 
              data-ref="toggleBtn" 
              title="${s?"Expand":"Minimize"}"
            >
              ${s?"⬆":"⬇"}
            </button>
            <button 
              class="perf-dashboard__btn" 
              data-ref="closeBtn" 
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
        
        ${s?"":`
          <div class="perf-dashboard__content">
            <div class="perf-dashboard__metrics">
              ${this.renderCoreWebVitals(o)}
              ${this.renderLoadingMetrics(o)}
              ${this.renderMemoryMetrics(o)}
            </div>
            
            ${t&&n.length>0?`
              <div class="perf-dashboard__alerts">
                <h4>Alerts</h4>
                ${n.slice(0,3).map(f=>this.renderAlert(f)).join("")}
              </div>
            `:""}
          </div>
        `}
      </div>
    `}renderCoreWebVitals(e){return i.html`
      <div class="perf-metric-group">
        <h4>Core Web Vitals</h4>
        ${this.renderMetric("LCP",e.lcp,"ms",{good:2500,needsWork:4e3})}
        ${this.renderMetric("FID",e.fid,"ms",{good:100,needsWork:300})}
        ${this.renderMetric("CLS",e.cls,"",{good:.1,needsWork:.25})}
      </div>
    `}renderLoadingMetrics(e){return i.html`
      <div class="perf-metric-group">
        <h4>Loading</h4>
        ${this.renderMetric("TTFB",e.ttfb,"ms",{good:200,needsWork:500})}
        ${this.renderMetric("FCP",e.fcp,"ms",{good:1800,needsWork:3e3})}
        ${this.renderMetric("Load",e.loadComplete,"ms",{good:3e3,needsWork:5e3})}
      </div>
    `}renderMemoryMetrics(e){const t=e.memoryUsage;if(!t)return"";const a=Math.round(t.used/1024/1024),s=Math.round(t.total/1024/1024),r=Math.round(t.used/t.limit*100);return i.html`
      <div class="perf-metric-group">
        <h4>Memory</h4>
        <div class="perf-metric">
          <span class="perf-metric__label">JS Heap</span>
          <span class="perf-metric__value">
            ${a}/${s} MB (${r}%)
          </span>
        </div>
      </div>
    `}renderMetric(e,t,a,s){if(t===void 0)return"";const r=a==="ms"?Math.round(t):t.toFixed(2),o=t<=s.good?"good":t<=s.needsWork?"needs-work":"poor";return i.html`
      <div class="perf-metric">
        <span class="perf-metric__label">${e}</span>
        <span class="perf-metric__value perf-metric__value--${o}">
          ${r}${a}
        </span>
      </div>
    `}renderAlert(e){return i.html`
      <div class="perf-alert perf-alert--${e.type}">
        <div class="perf-alert__header">
          <span class="perf-alert__metric">${e.metric.toUpperCase()}</span>
          <span class="perf-alert__value">${Math.round(e.value)}</span>
        </div>
        <div class="perf-alert__message">${e.message}</div>
      </div>
    `}getScoreClass(e){return e>=90?"excellent":e>=75?"good":e>=50?"needs-work":"poor"}getStyles(){return i.css`
      .perf-dashboard {
        position: fixed;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        z-index: 10000;
        min-width: 280px;
        max-width: 320px;
        transition: all 0.3s ease;
      }

      .perf-dashboard--top-right {
        top: 20px;
        right: 20px;
      }

      .perf-dashboard--top-left {
        top: 20px;
        left: 20px;
      }

      .perf-dashboard--bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .perf-dashboard--bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .perf-dashboard--minimized {
        max-height: 40px;
      }

      .perf-dashboard__header {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.05);
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
      }

      .perf-dashboard__title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }

      .perf-dashboard__score {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
        min-width: 24px;
        text-align: center;
      }

      .perf-dashboard__score--excellent {
        background: #4caf50;
        color: white;
      }

      .perf-dashboard__score--good {
        background: #8bc34a;
        color: white;
      }

      .perf-dashboard__score--needs-work {
        background: #ff9800;
        color: white;
      }

      .perf-dashboard__score--poor {
        background: #f44336;
        color: white;
      }

      .perf-dashboard__controls {
        display: flex;
        gap: 4px;
      }

      .perf-dashboard__btn {
        background: none;
        border: none;
        padding: 4px 6px;
        cursor: pointer;
        border-radius: 3px;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      }

      .perf-dashboard__btn:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.1);
      }

      .perf-dashboard__content {
        padding: 12px;
        max-height: 400px;
        overflow-y: auto;
      }

      .perf-metric-group {
        margin-bottom: 16px;
      }

      .perf-metric-group h4 {
        margin: 0 0 8px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: #666;
        font-weight: 600;
      }

      .perf-metric {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }

      .perf-metric:last-child {
        border-bottom: none;
      }

      .perf-metric__label {
        color: #333;
        font-weight: 500;
      }

      .perf-metric__value {
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 3px;
      }

      .perf-metric__value--good {
        background: #e8f5e8;
        color: #2e7d32;
      }

      .perf-metric__value--needs-work {
        background: #fff3e0;
        color: #ef6c00;
      }

      .perf-metric__value--poor {
        background: #ffebee;
        color: #c62828;
      }

      .perf-dashboard__alerts {
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        padding-top: 12px;
        margin-top: 12px;
      }

      .perf-dashboard__alerts h4 {
        margin: 0 0 8px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: #666;
        font-weight: 600;
      }

      .perf-alert {
        background: #fff3e0;
        border-left: 3px solid #ff9800;
        padding: 6px 8px;
        margin-bottom: 6px;
        border-radius: 0 4px 4px 0;
      }

      .perf-alert--error {
        background: #ffebee;
        border-left-color: #f44336;
      }

      .perf-alert__header {
        display: flex;
        justify-content: space-between;
        font-weight: 600;
        font-size: 11px;
        margin-bottom: 2px;
      }

      .perf-alert__message {
        font-size: 10px;
        color: #666;
      }

      @media (max-width: 768px) {
        .perf-dashboard {
          max-width: 260px;
          font-size: 11px;
        }
        
        .perf-dashboard--top-right,
        .perf-dashboard--bottom-right {
          right: 10px;
        }
        
        .perf-dashboard--top-left,
        .perf-dashboard--bottom-left {
          left: 10px;
        }
      }
    `}cacheElements(){this.getElement("dashboard",'[data-ref="dashboard"]'),this.getElement("header",'[data-ref="header"]'),this.getElement("toggleBtn",'[data-ref="toggleBtn"]',!1),this.getElement("closeBtn",'[data-ref="closeBtn"]',!1)}bindEvents(){const e=this.getElement("header",'[data-ref="header"]'),t=this.getElement("toggleBtn",'[data-ref="toggleBtn"]',!1),a=this.getElement("closeBtn",'[data-ref="closeBtn"]',!1);e&&this.addEventListener(e,"dblclick",this.toggle.bind(this)),t&&this.addEventListener(t,"click",this.toggle.bind(this)),a&&this.addEventListener(a,"click",this.hide.bind(this))}toggle(){this.setState({isMinimized:!this.state.isMinimized})}hide(){this.setState({isVisible:!1})}show(){this.setState({isVisible:!0})}async destroy(){this.updateTimer&&(clearInterval(this.updateTimer),this.updateTimer=null),await super.destroy()}}class u extends p{constructor(e){const t={isMinimized:e.minimized||!1,isVisible:!0,currentSession:null,metrics:{averageTimeOnSite:0,bounceRate:0,pagesPerSession:0,topPages:[],topInteractions:[],deviceTypes:{},referrers:{}},realtimeData:{activeVisitors:1,currentPage:window.location.pathname,sessionDuration:0,interactionCount:0}};super("AnalyticsDashboard",e,t,{debug:!0}),this.trackingService=null,this.updateTimer=null,this.template={render:()=>this.renderTemplate(),css:()=>this.getStyles()}}async mounted(){try{this.trackingService=await h.resolve("VisitorTrackingService"),this.startDataUpdate()}catch(e){console.warn("[AnalyticsDashboard] Visitor tracking service not available:",e)}}startDataUpdate(){const e=this.props.updateInterval||5e3;this.updateTimer=setInterval(()=>{this.updateData()},e),this.updateData()}updateData(){if(!this.trackingService)return;const e=this.trackingService.getCurrentSession(),t=this.trackingService.getEngagementMetrics(),a={activeVisitors:1,currentPage:window.location.pathname,sessionDuration:e?Date.now()-e.startTime:0,interactionCount:e?e.pageViews:0};this.setState({currentSession:e,metrics:t,realtimeData:a})}renderTemplate(){const{position:e="top-left",showRealTime:t=!0,showCharts:a=!1}=this.props,{isMinimized:s,isVisible:r,currentSession:o,metrics:n,realtimeData:d}=this.state;if(!r)return"";const l=`analytics-dashboard--${e}`,c=s?"analytics-dashboard--minimized":"";return i.html`
      <div class="analytics-dashboard ${l} ${c}" data-ref="dashboard">
        <div class="analytics-dashboard__header" data-ref="header">
          <div class="analytics-dashboard__title">
            <span class="analytics-dashboard__icon">📊</span>
            <span>Analytics</span>
          </div>
          <div class="analytics-dashboard__controls">
            <button 
              class="analytics-dashboard__btn" 
              data-ref="toggleBtn" 
              title="${s?"Expand":"Minimize"}"
            >
              ${s?"⬆":"⬇"}
            </button>
            <button 
              class="analytics-dashboard__btn" 
              data-ref="closeBtn" 
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        ${s?"":`
          <div class="analytics-dashboard__content">
            ${t?this.renderRealtimeMetrics(d,o):""}
            ${this.renderOverviewMetrics(n)}
            ${this.renderTopPages(n.topPages)}
            ${this.renderTopInteractions(n.topInteractions)}
          </div>
        `}
      </div>
    `}renderRealtimeMetrics(e,t){const a=Math.floor(e.sessionDuration/6e4),s=Math.floor(e.sessionDuration%6e4/1e3);return i.html`
      <div class="analytics-section">
        <h4 class="analytics-section__title">Real-time</h4>
        <div class="analytics-metrics">
          <div class="analytics-metric">
            <div class="analytics-metric__value">
              <span class="analytics-metric__dot analytics-metric__dot--active"></span>
              ${e.activeVisitors}
            </div>
            <div class="analytics-metric__label">Active Visitors</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">
              ${a}:${s.toString().padStart(2,"0")}
            </div>
            <div class="analytics-metric__label">Session Time</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">${t?.pageViews||0}</div>
            <div class="analytics-metric__label">Page Views</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">${t?.bounced?"Yes":"No"}</div>
            <div class="analytics-metric__label">Bounced</div>
          </div>
        </div>
      </div>
    `}renderOverviewMetrics(e){const t=Math.floor(e.averageTimeOnSite/6e4),a=Math.floor(e.averageTimeOnSite%6e4/1e3);return i.html`
      <div class="analytics-section">
        <h4 class="analytics-section__title">Overview</h4>
        <div class="analytics-metrics">
          <div class="analytics-metric">
            <div class="analytics-metric__value">
              ${t}:${a.toString().padStart(2,"0")}
            </div>
            <div class="analytics-metric__label">Avg. Time on Site</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">${e.bounceRate.toFixed(1)}%</div>
            <div class="analytics-metric__label">Bounce Rate</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">${e.pagesPerSession.toFixed(1)}</div>
            <div class="analytics-metric__label">Pages/Session</div>
          </div>
        </div>
      </div>
    `}renderTopPages(e){return e.length===0?"":i.html`
      <div class="analytics-section">
        <h4 class="analytics-section__title">Top Pages</h4>
        <div class="analytics-list">
          ${e.slice(0,5).map(t=>{const a=Math.floor(t.avgTime/6e4),s=Math.floor(t.avgTime%6e4/1e3);return`
              <div class="analytics-list__item">
                <div class="analytics-list__main">
                  <span class="analytics-list__name">${t.url.split("/").pop()||t.url}</span>
                  <span class="analytics-list__value">${t.views} views</span>
                </div>
                <div class="analytics-list__sub">
                  Avg. time: ${a}:${s.toString().padStart(2,"0")}
                </div>
              </div>
            `}).join("")}
        </div>
      </div>
    `}renderTopInteractions(e){return e.length===0?"":i.html`
      <div class="analytics-section">
        <h4 class="analytics-section__title">Top Interactions</h4>
        <div class="analytics-list">
          ${e.slice(0,5).map(t=>`
            <div class="analytics-list__item">
              <div class="analytics-list__main">
                <span class="analytics-list__name">${t.element}</span>
                <span class="analytics-list__value">${t.count}x</span>
              </div>
              <div class="analytics-list__sub">
                Type: ${t.type}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `}getStyles(){return i.css`
      .analytics-dashboard {
        position: fixed;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        z-index: 10000;
        min-width: 280px;
        max-width: 320px;
        transition: all 0.3s ease;
      }

      .analytics-dashboard--top-left {
        top: 20px;
        left: 20px;
      }

      .analytics-dashboard--top-right {
        top: 20px;
        right: 20px;
      }

      .analytics-dashboard--bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .analytics-dashboard--bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .analytics-dashboard--minimized {
        max-height: 40px;
      }

      .analytics-dashboard__header {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.05);
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
      }

      .analytics-dashboard__title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }

      .analytics-dashboard__icon {
        font-size: 14px;
      }

      .analytics-dashboard__controls {
        display: flex;
        gap: 4px;
      }

      .analytics-dashboard__btn {
        background: none;
        border: none;
        padding: 4px 6px;
        cursor: pointer;
        border-radius: 3px;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      }

      .analytics-dashboard__btn:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.1);
      }

      .analytics-dashboard__content {
        padding: 12px;
        max-height: 500px;
        overflow-y: auto;
      }

      .analytics-section {
        margin-bottom: 16px;
      }

      .analytics-section:last-child {
        margin-bottom: 0;
      }

      .analytics-section__title {
        margin: 0 0 8px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: #666;
        font-weight: 600;
      }

      .analytics-metrics {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .analytics-metric {
        text-align: center;
        padding: 8px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 4px;
      }

      .analytics-metric__value {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin-bottom: 2px;
      }

      .analytics-metric__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ccc;
      }

      .analytics-metric__dot--active {
        background: #4caf50;
        animation: pulse 2s infinite;
      }

      .analytics-metric__label {
        font-size: 10px;
        color: #666;
        text-transform: uppercase;
        font-weight: 500;
      }

      .analytics-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .analytics-list__item {
        padding: 6px 8px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 4px;
        border-left: 3px solid var(--color-primary, #ff6b6b);
      }

      .analytics-list__main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2px;
      }

      .analytics-list__name {
        font-weight: 500;
        color: #333;
        font-size: 11px;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .analytics-list__value {
        font-weight: 600;
        color: var(--color-primary, #ff6b6b);
        font-size: 11px;
      }

      .analytics-list__sub {
        font-size: 10px;
        color: #666;
        opacity: 0.8;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      @media (max-width: 768px) {
        .analytics-dashboard {
          max-width: 260px;
          font-size: 11px;
        }
        
        .analytics-dashboard--top-left,
        .analytics-dashboard--bottom-left {
          left: 10px;
        }
        
        .analytics-dashboard--top-right,
        .analytics-dashboard--bottom-right {
          right: 10px;
        }
      }
    `}cacheElements(){this.getElement("dashboard",'[data-ref="dashboard"]'),this.getElement("header",'[data-ref="header"]'),this.getElement("toggleBtn",'[data-ref="toggleBtn"]',!1),this.getElement("closeBtn",'[data-ref="closeBtn"]',!1)}bindEvents(){const e=this.getElement("header",'[data-ref="header"]'),t=this.getElement("toggleBtn",'[data-ref="toggleBtn"]',!1),a=this.getElement("closeBtn",'[data-ref="closeBtn"]',!1);e&&this.addEventListener(e,"dblclick",this.toggle.bind(this)),t&&this.addEventListener(t,"click",this.toggle.bind(this)),a&&this.addEventListener(a,"click",this.hide.bind(this))}toggle(){this.setState({isMinimized:!this.state.isMinimized})}hide(){this.setState({isVisible:!1})}show(){this.setState({isVisible:!0})}exportData(){return this.trackingService?this.trackingService.exportData():null}async destroy(){this.updateTimer&&(clearInterval(this.updateTimer),this.updateTimer=null),await super.destroy()}}export{u as A,v as P};
