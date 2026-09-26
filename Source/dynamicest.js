// === 数值存储 =================================
Dynamicest.First = true;
Dynamicest.Debug = false;
Dynamicest.Finish = [];
Dynamicest.DisplayFold = {};
Dynamicest.DisplayFoldMax = 5;
Dynamicest.DisplayFoldClose = false;
Dynamicest.LastMoney = null;
Dynamicest.LastState = new Map();
Dynamicest.LastCharacteristics = {};
Dynamicest.LastRelations = {};
Dynamicest.LastTraits = {};
Dynamicest.LastJournals = {};
Dynamicest.LastJournalsID = {};
Dynamicest.LastValues = {};
Dynamicest.LastSides = [];
Dynamicest.HistorySides = new Set();
Dynamicest.CheckedOld = null;  // 最近一次数值检查的旧值，供数字缓动插值使用
Dynamicest.EaseDuration = 1000;  // 数字缓动插值时长（毫秒）


Dynamicest.debugging = Dynamicest.setDubug = function(debug=true) {
    Dynamicest.Debug = debug;
    Dynamicest.settingDynamicestDisplay();
}


// === 注入 =====================================
$(document).on(":passagerender", function (ev) {Dynamicest.onPassageRender(ev)});
// 【工具】注入游戏宏，在调用原宏后再执行指定的功能。
Dynamicest.onMacro = function(macroName, afterFn) {
    let originalMacro = Macro.get(macroName);
    if (originalMacro) {
        let oldHandler = originalMacro.handler;
        Macro.delete(macroName);
        Macro.add(macroName, {
            handler: function () {
                oldHandler.apply(this, arguments);
                afterFn.apply(this, arguments);
            }
        });
    }
};

Dynamicest.onPassageRender = function (ev) {

    // 新页面渲染时重置展示队列，使第一批无需等待直接弹出
    clearTimeout(Dynamicest.ShowTimer);
    clearTimeout(Dynamicest.ShowPendingTimer);
    Dynamicest.ShowPending = false;
    Dynamicest.ShowRunning = false;
    Dynamicest.ShowQueue = [];

    // === 数值存储存档 ==============================
    V.Dynamicest = V.Dynamicest || {};

    // 设置
    V.Dynamicest.Settings = V.Dynamicest.Settings || {};
    V.Dynamicest.Settings.EnableSides = V.Dynamicest.Settings.EnableSides ?? true;
    V.Dynamicest.Settings.FilterRelations = V.Dynamicest.Settings.FilterRelations || ["巨鹰 恐怖者"];
    V.Dynamicest.Settings.FilterCharacteristics = V.Dynamicest.Settings.FilterCharacteristics || [];
    V.Dynamicest.Settings.FilterTraits = V.Dynamicest.Settings.FilterTraits || ["防晒霜"];
    V.Dynamicest.Settings.FilterJournals = V.Dynamicest.Settings.FilterJournals || [];
    V.Dynamicest.Settings.FilterSides = V.Dynamicest.Settings.FilterSides || [];

    V.Dynamicest.Settings.FilterBodyTemperature = V.Dynamicest.Settings.FilterBodyTemperature ?? false;
    V.Dynamicest.Settings.FilterOutside = V.Dynamicest.Settings.FilterOutside ?? false;
    V.Dynamicest.Settings.FilterComdoms = V.Dynamicest.Settings.FilterComdoms ?? false;
    V.Dynamicest.Settings.FilterSpray = V.Dynamicest.Settings.FilterSpray ?? false;

    V.Dynamicest.Settings.DynamicestDisplayPenetrate = V.Dynamicest.Settings.DynamicestDisplayPenetrate ?? true;
    V.Dynamicest.Settings.DynamicestShowNPCAppearance = V.Dynamicest.Settings.DynamicestShowNPCAppearance ?? true;
    V.Dynamicest.Settings.DynamicestFlash = V.Dynamicest.Settings.DynamicestFlash ?? true;
    V.Dynamicest.Settings.DynamicestDisplayTop = V.Dynamicest.Settings.DynamicestDisplayTop ?? 10;
    V.Dynamicest.Settings.DynamicestDisplayScale = V.Dynamicest.Settings.DynamicestDisplayScale ?? 1.0;
    V.Dynamicest.Settings.DynamicestDisplayOpacity = V.Dynamicest.Settings.DynamicestDisplayOpacity ?? 1.0;
    V.Dynamicest.Settings.DynamicestDisplayDuration = V.Dynamicest.Settings.DynamicestDisplayDuration ?? 1200;
    Dynamicest.settingDynamicestDisplay();

    // 不允许首页出现，因为会导致首次判断出错
    if (V.passage === "Start") return;
    if (V.passage.startsWith("ScarletBook")) return;  // 想象珍妮特时所有属性都会改变将导致界面卡死
    Dynamicest.ev = ev;
    Dynamicest.DisplayFold = {};
    Dynamicest.DisplayFoldClose = false;

    setTimeout(() => {
        Dynamicest.updateTimeBar();  // 时间进度条随页面渲染重建
        Dynamicest.LoadStats();
        Dynamicest.LoadMoney();
        Dynamicest.LoadValues();

        const passage = V.passage;

        const runTask = (task) => {
            if (passage === V.passage) {
                return new Promise(resolve => {
                    requestAnimationFrame(() => {
                        task();
                        resolve();
                    });
                });
            }
        };
        
        runTask(() => {})
            .then(() => runTask(() => Dynamicest.LoadSides()))
            .then(() => runTask(() => Dynamicest.LoadJournals()))
            .then(() => runTask(() => Dynamicest.LoadSocials()))
            .then(() => runTask(() => Dynamicest.LoadCharacteristics()))
            .then(() => runTask(() => Dynamicest.LoadTraits()))
            .then(() => runTask(() => {
                Dynamicest.First = false;
                Dynamicest.LoadFoldedDisplay();
            }))
            .then(() => Dynamicest.RunShowQueue());  // 渲染链入队完毕，凑满第一批无需等待直接弹出
    });
};

Dynamicest.npc_appearance = function() {
    if (V.Dynamicest.Settings.DynamicestDisplayPenetrate) {
        let name = T.nam;
        if (setup.NPCNameList_cn_name) {
            name = setup.NPCNameList_cn_name.split(`${T.nam},`)[1]?.split("|")[0]
        }
        if (name) {
            const relation_title = Object.keys(Dynamicest.LastRelations).find((key) => key.includes(name));
            if (relation_title) {
                T.DynamicestSocialsForceShow = [...T.DynamicestSocialsForceShow??[], relation_title]
            }
        }
    }
}

$(document).one(":passageinit", function () {
    Dynamicest.onMacro("npc", Dynamicest.npc_appearance);
});

Dynamicest.statChange = function() {
    const key = T.statkey;
    if (key !== undefined) {//_barColour
        T.statkey = undefined;
        const values = [T.percent, T.minPercent, T.pin, T.statColor];
        if (Dynamicest.LastState.has(key)) {
            [T.percent, T.minPercent, T.pin, T.statColor] = Dynamicest.LastState.get(key);
        } else {
            [T.percent, T.minPercent, T.pin, T.statColor] = [0, 0, 0, "whitebar"]
        }
        
        T.statChanged = T.statChanged || {}
        T.statChanged[key] = values;
    }
}

Dynamicest.statChangeDrunk = function(_barColour, _percent) {
    const key = T.statkey;
    if (key !== undefined) {
        T.statkey = undefined;
        const values = [_percent, null, null, _barColour];
        let barWidth, barColour;
        if (Dynamicest.LastState.has(key)) {
            barWidth = `width:${Dynamicest.LastState.get(key)[0]}%`;
            barColour = Dynamicest.LastState.get(key)[3];
        } else {
            barWidth = "width: 0%";
            barColour = "whitebar"
        }
        
        T.statChanged = T.statChanged || {}
        T.statChanged[key] = values;

        return [barColour, barWidth]
    }
    return [_barColour, `width:${_percent}%`]
}

Dynamicest.allureChange = function() {
    const key = "allurecaption";
    let statColor = "greenbar";
    if (V.allure >= (6000 * V.settings.allureModifier)) {
        statColor = "redbar"
    } else if (V.allure >= (4000 * V.settings.allureModifier)) {
        statColor = "pinkbar"
    } else if (V.allure >= (3000 * V.settings.allureModifier)) {
        statColor = "purplebar"
    } else if (V.allure >= (2000 * V.settings.allureModifier)) {
        statColor = "bluebar"
    } else if (V.allure >= (1500 * V.settings.allureModifier)) {
        statColor = "lbluebar"
    } else if (V.allure >= (1000 * V.settings.allureModifier)) {
        statColor = "tealbar"
    }
    const values = [T.percent, V.allure, null, statColor];
    if (Dynamicest.LastState.has(key)) {
        const LastState = Dynamicest.LastState.get(key)
        T.percent = LastState[0];
        V.allure = LastState[1];
    }
    T.statChanged = T.statChanged || {}
    T.statChanged[key] = values;
}

Dynamicest.allureChangeFinish = function() {
    const key = "allurecaption";
    if (T.statChanged && T.statChanged.hasOwnProperty(key)) {
        V.allure = T.statChanged[key][1];
    }
}

Dynamicest.LoadStats = function() {
    if (T.statChanged) {
        Object.keys(T.statChanged).forEach(key => {
            Dynamicest.LastState.set(key, T.statChanged[key]);
        })
        delete T.statChanged;
    }

    let i = 0;
    const stowed = document.getElementById("ui-bar").classList.contains("stowed");
    Dynamicest.LastState.keys().forEach(key => {
        const values = Dynamicest.LastState.get(key);
        let anchor_primary, anchor_secondary;
        if (stowed) {
            anchor_primary = document.getElementById(key+"stat");
            anchor_secondary = document.getElementById(key);
        } else {
            anchor_primary = document.getElementById(key);
            anchor_secondary = document.getElementById(key+"stat");
        }

        const meter_primary = anchor_primary?.querySelector(".meter");
        if (meter_primary) {
            const statbar = meter_primary.children[0];
            if (statbar) {
                if (statbar.style.width !== values[0] + "%") {
                    setTimeout(() => {
                        if (V.Dynamicest.Settings.DynamicestFlash) {
                            let container;
                            if (stowed) { container = $(`#${key+"stat"}`).parent(); } else { container = $(`#${key}`); }
                            container.css("animation", `dynamicest-highlight-${values[3]} 1s ease 1`);
                        }
                        statbar.style.width = values[0] + "%";
                        statbar.className = values[3];
                    }, 100 * i);
                    i++;
                }
            }
        }

        const meter_secondary = anchor_secondary?.querySelector(".meter");
        if (meter_secondary) {
            const statbar = meter_secondary.children[0];
            if (statbar) {
                statbar.style.width = values[0] + "%";
                statbar.className = values[3];
            }
        }
    })
}

// === 金钱动态 =================================
Dynamicest.animateMoneyChange = function(lastMoney, newMoney, relMoneyAbs, isPositive) {
    const relElement = document.getElementById('relmoney');
    const nowElement = document.getElementById('nowmoney');
    
    if (!relElement || !nowElement) return;
    
    const startTime = performance.now();
    const duration = 1000; // 1秒
    
    // 转换为数字
    const startNow = parseFloat(lastMoney);
    const endNow = parseFloat(newMoney);
    const startRel = parseFloat(relMoneyAbs);
    
    const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数让动画更自然
        const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        
        // 计算当前值
        const currentRel = startRel * (1 - easeProgress);
        const currentNow = startNow + (endNow - startNow) * easeProgress;
        
        // 更新显示
        if (progress < 1) {
            // relmoney 逐渐减少到0
            if (startRel > 0) {
                relElement.textContent = `£ ${isPositive ? '+' : '-'}${currentRel.toFixed(2)}`;
            }
            
            // nowmoney 逐渐变化
            nowElement.textContent = `£ ${currentNow.toFixed(2)}`;
            
            requestAnimationFrame(animate);
        } else {
            // 动画结束，设置为最终值
            relElement.textContent = `£ ${isPositive ? '+' : '-'}0.00`;
            nowElement.textContent = `£ ${newMoney}`;
        }
    };
    
    requestAnimationFrame(animate);
};
Dynamicest.LoadMoney = function() {
    const newMoney = (V.money / 100).toFixed(2);
    const lastMoney = Dynamicest.LastMoney ? (Dynamicest.LastMoney / 100).toFixed(2) : null;
    
    if (lastMoney && newMoney !== lastMoney) {
        const relMoney = (parseFloat(newMoney) - parseFloat(lastMoney)).toFixed(2);
        const relMoneyAbs = Math.abs(relMoney).toFixed(2);
        const isPositive = relMoney >= 0;

        Dynamicest.EnqueueShow("money", "money-box-list box-dynamicest-half", (list) => {
            list.innerHTML = `
            <div>
                <span>转账</span>
                <span id="relmoney">£ ${isPositive ? '+' : '-'}${relMoneyAbs}</span>
            </div>
            <div id="barmoney"></div>
            <div>
                <span></span>
                <span id="nowmoney">£ ${lastMoney}</span>
            </div>
            `;
        }, () => {
            // 启动动画
            setTimeout(() => {
                Dynamicest.animateMoneyChange(lastMoney, newMoney, relMoneyAbs, isPositive);
            }, 1000);

            Dynamicest.FinishList("money", 2000);
        });
    }
    Dynamicest.LastMoney = V.money;
};

// === 隐藏属性动态 =============================
Dynamicest.GetDisplay = function() {
    let display = document.getElementById("display-dynamicest");
    if (!display) {
        display = Object.assign(document.createElement("div"), {
            id: "display-dynamicest",
            className: "display-dynamicest characteristics-display"
        });
        $(Dynamicest.ev.content).append(display);
    };
    return display
};
Dynamicest.GetList = function(id, class_) {
    id = id.trim();
    const display = Dynamicest.GetDisplay();
    let list = null;
    if (id) {
        list = display.querySelector(`#box-dynamicest-list-${id}`);
        if (!list) {
            list = document.createElement("div");
            list.id = `box-dynamicest-list-${id}`;
        };
    } else {
        list = document.createElement("div");
    }
    list.className = "dynamicest-hide box-dynamicest "+class_;
    display.append(list);
    list.offsetHeight;  // 强制渲染隐藏状态后立即淡入，减少页面切换到弹出的延迟
    list.classList.remove("dynamicest-hide");
    return list
};
Dynamicest.FinishList = function(id, delay) {
    id = id.trim();
    let list = document.querySelector(`#box-dynamicest-list-${id}`);
    Dynamicest.Finish.push(id);
    if (list && !Dynamicest.Debug) {
        setTimeout(() => {
            if (Dynamicest.Finish.includes(id)) {
                list.classList.add("dynamicest-hide");
                setTimeout(() => list.remove(), 800);
                Dynamicest.Finish.splice(Dynamicest.Finish.indexOf(id), 1);
            }
        }, delay + (V.Dynamicest.Settings.DynamicestDisplayDuration ?? 800));
    };
};
Dynamicest.CancelFinishList = function(id) {
    if (Dynamicest.Finish.includes(id)) {
        Dynamicest.Finish.splice(Dynamicest.Finish.indexOf(id), 1);
        return true;
    }
    return false;
};
// === 展示队列 =================================
// 每次最多同时展示 ShowBatchMax 个弹窗动画，缓动结束后再展示下一批，直到全部完成
// 弹窗入队后立即以排队预览的形式显示：固定20px高度、内容顶部对齐、超出裁剪并模糊
// 轮到展示时缓动恢复自动高度和清晰；单击排队中的弹窗可以提前展开并置顶
Dynamicest.ShowQueue = [];
Dynamicest.ShowRunning = false;
Dynamicest.ShowPending = false;  // 是否已有兜底调度在等待
Dynamicest.ShowBatchMax = 3;
Dynamicest.ShowDuration = 1000;  // 每批动画的缓动展示时长（毫秒）
Dynamicest.ExpandQueue = function(list) {
    if (!list.classList.contains("dynamicest-queued")) return;  // 非排队预览态（如复用已有弹窗）无需展开
    list.classList.remove("dynamicest-queued");  // 缓动恢复清晰
    // 高度从20px缓动恢复自动高度
    const target = list.offsetHeight;
    list.style.boxSizing = "border-box";  // 统一height与offsetHeight口径，避免恢复高度偏大padding+border
    list.style.height = "20px";
    list.style.overflow = "hidden";  // 过渡期间继续裁剪超出部分
    list.offsetHeight;
    list.style.height = target + "px";
    setTimeout(() => {
        list.style.height = "";
        list.style.overflow = "";
        list.style.boxSizing = "";
        // 展开完成后容器自动下滑，跟随最新弹窗
        const container = list.parentElement;
        if (container) container.scrollTop = container.scrollHeight;
    }, 400);
};
Dynamicest.EnqueueShow = function(id, class_, fill, activate) {
    id = (id ?? "").trim();
    const display = Dynamicest.GetDisplay();
    const existed = id ? !!display.querySelector(`#box-dynamicest-list-${id}`) : true;  // 复用已有弹窗时不进入排队预览
    const list = Dynamicest.GetList(id, class_);
    fill(list);  // 入队时立即填充内容，形成排队预览
    display.scrollTop = display.scrollHeight;  // 自动下滑跟随新增的排队弹窗

    const passage = V.passage;
    const task = () => {
        list.onclick = null;
        if (passage !== V.passage) { list.remove(); return; }
        Dynamicest.ExpandQueue(list);  // 缓动展开；同一同步块内注入旧值并启动动画，弹出首帧即为旧值，不闪动
        if (activate) activate(list);
    };

    if (!existed) {
        list.classList.add("dynamicest-queued");  // 排队预览：固定20px高度、内容裁剪并模糊
        list.onclick = () => {  // 单击提前展开并置顶
            const index = Dynamicest.ShowQueue.indexOf(task);
            if (index >= 0) Dynamicest.ShowQueue.splice(index, 1);
            display.prepend(list);
            display.scrollTop = 0;  // 置顶后回到顶部，保证可见
            task();
        };
    }

    Dynamicest.ShowQueue.push(task);
    if (!Dynamicest.ShowPending) {  // 兜底调度：防止渲染链中断导致队列无人激活
        Dynamicest.ShowPending = true;
        Dynamicest.ShowPendingTimer = setTimeout(() => {
            Dynamicest.ShowPending = false;
            Dynamicest.RunShowQueue();
        }, 500);
    }
};
Dynamicest.RunShowQueue = function(fromTimer) {
    if (!fromTimer && Dynamicest.ShowRunning) return;  // 已有批次在展示，等待其计时结束
    const tasks = Dynamicest.ShowQueue.splice(0, Dynamicest.ShowBatchMax);
    if (tasks.length === 0) {
        Dynamicest.ShowRunning = false;
        return;
    }
    Dynamicest.ShowRunning = true;
    tasks.forEach(task => {
        try { task(); } catch (e) { console.error("Dynamicest:", e); }
    });
    Dynamicest.ShowTimer = setTimeout(() => Dynamicest.RunShowQueue(true), Dynamicest.ShowDuration);
};
Dynamicest.applyTransition = function(oldElement, newElement) {
    // 递归比较两个元素的子节点
    const compareAndAnimate = (oldNode, newNode) => {
        if (!oldNode || !newNode || oldNode.nodeType !== 1 || newNode.nodeType !== 1) return;

        // 仪表条单独使用颜色差分动画
        if (oldNode.classList.contains("meter") && newNode.classList.contains("meter")) {
            Dynamicest.diffMeter(oldNode, newNode);
            return;
        }

        // 获取旧元素的所有内联样式
        if (oldNode.style && newNode.style) {
            const oldStyle = oldNode.style;
            const newStyle = newNode.style;
            
            // 如果有内联样式，先设置为旧值，然后过渡到新值
            if (oldStyle.length > 0 || newStyle.length > 0) {
                // 保存新元素的原始内联样式
                const originalStyles = {};
                for (let i = 0; i < newStyle.length; i++) {
                    const prop = newStyle[i];
                    originalStyles[prop] = newStyle.getPropertyValue(prop);
                }
                newNode.style.transition = "none";
                // 将新元素的内联样式设置为旧元素的值
                for (let i = 0; i < oldStyle.length; i++) {
                    const prop = oldStyle[i];
                    const value = oldStyle.getPropertyValue(prop);
                    newNode.style.setProperty(prop, value);
                }
                newNode.style.transition = "";
                // 恢复为新样式，触发过渡
                ((newNode, originalStyles) => setTimeout(() => {
                    for (const [prop, value] of Object.entries(originalStyles)) {
                        newNode.style.setProperty(prop, value);
                    }
                }, 400))(newNode, originalStyles);
            }
        }
        
        // 递归比较子节点
        const oldChildren = oldNode.children;
        const newChildren = newNode.children;
        const maxLength = Math.max(oldChildren.length, newChildren.length);
        
        for (let i = 0; i < maxLength; i++) {
            compareAndAnimate(oldChildren[i], newChildren[i]);
        }
    };
    
    compareAndAnimate(oldElement, newElement);

    // 数字文本缓动插值
    Dynamicest.interpolateTree(oldElement, newElement);

    const oldimgs = oldElement.querySelectorAll("img")
    const newimgs = newElement.querySelectorAll("img")
    const maxLength = Math.max(oldimgs.length, newimgs.length);
    for (let index = 0; index < maxLength; index++) {
        const oldimg = oldimgs[index];
        const newimg = newimgs[index];
        if (oldimg && newimg && oldimg.src !== newimg.src) {
            newimg.style.transition = 'none';
            newimg.style.opacity = 0;
            newimg.style.scale = 1.5;
            newimg.offsetHeight;
            newimg.style.transition = '';
            (img => setTimeout(() => {img.style.opacity = 1; img.style.scale = 1;}, 200 * index))(newimg);
        }
    }
};

// === 差分与插值 ===============================
// 仪表条颜色差分：减少的部分红色高亮显示减少多少，增加的部分绿色高亮，减少时延迟一会再缓慢过渡到目标
Dynamicest.diffMeter = function(oldMeter, newMeter) {
    const oldBar = oldMeter.children[0];
    const newBar = newMeter.children[0];
    if (!oldBar || !newBar) return;
    const oldW = parseFloat(oldBar.style.width);
    const newW = parseFloat(newBar.style.width);
    if (Number.isNaN(oldW) || Number.isNaN(newW) || oldW === newW) return;
    const down = newW < oldW;

    // 差分高亮条垫底，标记增减的部分，由meter条对齐覆盖
    const diff = document.createElement("div");
    diff.className = down ? "dynamicest-diff-down" : "dynamicest-diff-up";
    diff.style.left = Math.min(oldW, newW) + "%";
    diff.style.width = Math.abs(newW - oldW) + "%";
    newMeter.prepend(diff);
    // setTimeout(() => diff.remove(), 2000);

    
    // 先停留在旧值，再缓动到新值
    newBar.style.transition = "none";
    newBar.style.width = oldW + "%";
    newBar.offsetHeight;
    newBar.style.transition = down
        ? "width 1.3s cubic-bezier(0.4, 0, 0.2, 1) 0.5s, background-color 0.8s ease"
        : "width 1s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.8s ease";
    newBar.style.width = newW + "%";
    setTimeout(() => {newBar.style.transition = "";}, down ? 1800 : 1000);
};
// 配对遍历新旧元素的文本节点，对可插值的数字文本进行缓动
Dynamicest.interpolateTree = function(oldElement, newElement) {
    const oldTexts = [];
    const newTexts = [];
    const oldWalker = document.createTreeWalker(oldElement, NodeFilter.SHOW_TEXT);
    const newWalker = document.createTreeWalker(newElement, NodeFilter.SHOW_TEXT);
    while (oldWalker.nextNode()) oldTexts.push(oldWalker.currentNode);
    while (newWalker.nextNode()) newTexts.push(newWalker.currentNode);
    const length = Math.min(oldTexts.length, newTexts.length);
    for (let index = 0; index < length; index++) {
        Dynamicest.interpolateText(oldTexts[index], newTexts[index]);
    }
};
// 数字文本缓动插值，支持"0%"→"3%"等带前后缀的形式
Dynamicest.interpolateText = function(oldNode, newNode) {
    const oldText = oldNode.nodeValue ?? "";
    const newText = newNode.nodeValue ?? "";
    if (oldText === newText) return;
    // 按数字分段，只有非数字部分完全一致才进行插值
    const splitNumbers = (text) => text.split(/(-?\d+(?:\.\d+)?)/);
    const oldParts = splitNumbers(oldText);
    const newParts = splitNumbers(newText);
    if (oldParts.length !== newParts.length || newParts.length < 3) return;
    for (let i = 0; i < newParts.length; i += 2) {
        if (oldParts[i] !== newParts[i]) return;
    }
    const oldNums = [], newNums = [], decimals = [];
    for (let i = 1; i < newParts.length; i += 2) {
        oldNums.push(parseFloat(oldParts[i]));
        newNums.push(parseFloat(newParts[i]));
        decimals.push((newParts[i].split(".")[1] ?? "").length);
    }

    // 插值期间文本背景发光，强度由最初的1渐变到完成时的0
    const parent = newNode.parentElement;
    const glow = (intensity) => {
        if (!parent) return;
        parent.style.textShadow = intensity > 0 ? `0 0 ${(8 * intensity).toFixed(1)}px rgba(255, 200, 80, ${(1 * intensity).toFixed(3)})` : "";
    };
    glow(1);

    const startTime = performance.now();
    const duration = Dynamicest.EaseDuration;
    newNode.nodeValue = oldText;  // 初始为旧值，随后缓动到新值
    const frame = (currentTime) => {
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        let text = "";
        for (let i = 0; i < newParts.length; i += 2) {
            text += newParts[i];
            if (i + 1 < newParts.length) {
                const value = oldNums[i >> 1] + (newNums[i >> 1] - oldNums[i >> 1]) * easeProgress;
                text += value.toFixed(decimals[i >> 1]);
            }
        }
        newNode.nodeValue = text;
        glow(1 - progress);
        if (progress < 1) requestAnimationFrame(frame);
        else {
            newNode.nodeValue = newText;
            glow(0);
        }
    };
    requestAnimationFrame(frame);
};
// 已知旧值与新值时，对容器中显示新值的文本节点进行缓动插值
Dynamicest.easeTextValue = function(container, oldValue, newValue) {
    if (!Number.isFinite(oldValue) || !Number.isFinite(newValue) || oldValue === newValue) return;
    const decimals = (String(newValue).split(".")[1] ?? "").length;
    const match = new RegExp(`(?<![\\d.])${String(newValue).replace(".", "\\.")}(?![\\d.])`);
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        const result = node.nodeValue.match(match);
        if (result) {
            const index = result.index;
            const prefix = node.nodeValue.slice(0, index);
            const suffix = node.nodeValue.slice(index + result[0].length);
            // 插值期间文本背景发光，强度由最初的1渐变到完成时的0
            const parent = node.parentElement;
            const glow = (intensity) => {
                if (!parent) return;
                parent.style.textShadow = intensity > 0 ? `0 0 ${(8 * intensity).toFixed(1)}px rgba(255, 200, 80, ${(1 * intensity).toFixed(3)})` : "";
            };
            glow(1);

            const startTime = performance.now();
            const duration = Dynamicest.EaseDuration;
            node.nodeValue = prefix + oldValue + suffix;  // 初始为旧值
            const frame = (currentTime) => {
                const progress = Math.min((currentTime - startTime) / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
                const value = oldValue + (newValue - oldValue) * easeProgress;
                node.nodeValue = prefix + value.toFixed(decimals) + suffix;
                glow(1 - progress);
                if (progress < 1) requestAnimationFrame(frame);
                else {
                    node.nodeValue = prefix + newValue + suffix;
                    glow(0);
                }
            };
            requestAnimationFrame(frame);
            return;
        }
    }
};

// === 社交动态 =================================
Dynamicest.LoadSocials = function() {
    Dynamicest.social_div = document.createElement("div");
    new Wikifier(Dynamicest.social_div, "<<social>>");
    const display = {};
    let display_num = 0;
    const NewRelations = {};
    const relation_boxes = Dynamicest.social_div.querySelectorAll(".relation-box");
    for (let index = 0; index < relation_boxes.length; index++) {
        const relation_box = relation_boxes[index];
        let relation_title = relation_box.querySelector(".relation-top-line > .relation-name")?.innerText.trim();
        const relation_class_id = relation_box.parentElement?.id;  // 这个键若为null，则在之后单独分组，但在display中为同一组

        if (relation_class_id === "global-recognition") {
            const isTotleFameContainer = relation_box.matches(':nth-child(12n)');
            const fullText = relation_box.querySelector(".relation-description").textContent;
            if (isTotleFameContainer) {
                relation_title = "总体名声";
            } else {
                const match = fullText.match(/\s*([^\s：]+)/);
                relation_title = match ? match[1] : '';
            }
        }  // 单独适配知名度

        if (relation_title && !V.Dynamicest.Settings.FilterRelations.includes(relation_title)) {  // 有Title，才有键，才可以动态查询修改
            const LastRelation = Dynamicest.LastRelations[relation_title];
            if (LastRelation) {
                if (LastRelation.innerText !== relation_box.innerText || T.DynamicestSocialsForceShow?.includes(relation_title)) {  // 有改动，动态展示，否则不变
                    if (!display.hasOwnProperty(relation_class_id)) display[relation_class_id] = [];
                    display[relation_class_id].push([LastRelation, relation_box]);  // 格式：原来的, 现在的
                    display_num += 1;
                }
            } else if (!Dynamicest.First) {
                if (!display.hasOwnProperty(relation_class_id)) display[relation_class_id] = [];
                display[relation_class_id].push([relation_box, relation_box]);  // 格式：都是现在的，这个是新NPC的出现
                display_num += 1;
            };
            NewRelations[relation_title] = relation_box.cloneNode(true);  // 不论前一个是否存在，都要保存；存快照防止弹窗动画改写元素导致重复弹出
        }
    }

    Dynamicest.LastRelations = NewRelations;

    if (display_num > Dynamicest.DisplayFoldMax) {
        Dynamicest.DisplayFold["relation-box-list"] = display;
    } else {
        for (const relation_class_id in display) {
            const relations = display[relation_class_id]
            Dynamicest.EnqueueShow(relation_class_id, "relation-box-list", (list) => {
                relations.forEach(([, NewRelation]) => list.append(NewRelation));
            }, () => {
                relations.forEach(([LastRelation, NewRelation]) => Dynamicest.applyTransition(LastRelation, NewRelation));
                Dynamicest.FinishList(relation_class_id, 800)
            });
        }
    }
};

// === 属性动态 =================================
Dynamicest.LoadCharacteristics = function() {
    Dynamicest.characteristic_div = document.createElement("div");
    new Wikifier(Dynamicest.characteristic_div, "<<characteristics>>");
    const display = {};
    let display_num = 0;
    const NewCharacteristics = {};
    const characteristic_boxes = Dynamicest.characteristic_div.querySelectorAll(".characteristic-box");
    for (let index = 0; index < characteristic_boxes.length; index++) {
        const characteristic_box = characteristic_boxes[index];
        const div_characteristic_title = characteristic_box.querySelector(".characteristic-top-line > .characteristic-title");
        const characteristic_title = Array.from(div_characteristic_title.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '')
            .map(node => node.textContent.trim())
            .join('');
        if (characteristic_title && !V.Dynamicest.Settings.FilterCharacteristics.includes(characteristic_title)) {  // 有Title，才有键，才可以动态查询修改
            const LastCharacteristic = Dynamicest.LastCharacteristics[characteristic_title];
            let characteristic_class_id = characteristic_box.parentElement?.id;  // 这个键若为null，则在之后单独分组，但在display中为同一组
            let content_changed = LastCharacteristic?.innerText !== characteristic_box?.innerText;

            if (characteristic_box.parentElement?.id === "base-characteristics") content_changed = content_changed || LastCharacteristic.querySelector(".meter > div")?.style.cssText !== characteristic_box.querySelector(".meter > div")?.style.cssText;  // 单独适配核心属性
            if (characteristic_box.parentElement?.className === "sex-diagram-box") characteristic_class_id = "sex-diagram";  // 单独适配性技能

            if (LastCharacteristic && content_changed) {  // 有改动，动态展示，否则不变
                if (!display.hasOwnProperty(characteristic_class_id)) {
                    display[characteristic_class_id] = [];
                }
                display[characteristic_class_id].push([LastCharacteristic, characteristic_box]);  // 格式：原来的, 现在的
                display_num += 1;
            }
            NewCharacteristics[characteristic_title] = characteristic_box.cloneNode(true)  // 不论前一个是否存在，都要保存；存快照防止弹窗动画改写元素导致重复弹出
        }
    };

    Dynamicest.LastCharacteristics = NewCharacteristics;

    if (display_num > Dynamicest.DisplayFoldMax) {
        Dynamicest.DisplayFold["characteristic-box-list"] = display
    } else {
        for (const characteristic_class_id in display) {
            const characteristics = display[characteristic_class_id]
            Dynamicest.EnqueueShow(characteristic_class_id, "characteristic-box-list", (list) => {
                characteristics.forEach(([, NewCharacteristic]) => list.append(NewCharacteristic));
            }, () => {
                characteristics.forEach(([LastCharacteristic, NewCharacteristic]) => Dynamicest.applyTransition(LastCharacteristic, NewCharacteristic));
                Dynamicest.FinishList(characteristic_class_id, 800)
            });
        }
    };
};

// === 特质动态 =================================
Dynamicest.LoadTraits = function() {
    Dynamicest.trait_div = document.createElement("div");
    new Wikifier(Dynamicest.trait_div, "<<traits>>");
    const display = {};
    let display_num = 0;
    const NewTraits = {};
    const trait_boxes = Dynamicest.trait_div.querySelectorAll(".trait");
    for (let index = 0; index < trait_boxes.length; index++) {
        const trait_box = trait_boxes[index];
        const trait_title = trait_box.querySelector("span")?.innerText.trim();
        const trait_class_id = trait_box.parentElement?.parentElement?.querySelector(".traitHeading")?.innerText.trim();  // 这个键若为null，则在之后单独分组，但在display中为同一组

        if (trait_title && !V.Dynamicest.Settings.FilterTraits.includes(trait_title)) {  // 有Title，才有键，才可以动态查询修改
            const LastTrait = Dynamicest.LastTraits[trait_title];
            if (LastTrait) {
                if (LastTrait.innerText !== trait_box.innerText) {  // 有改动，动态展示，否则不变
                    if (!display.hasOwnProperty(trait_class_id)) display[trait_class_id] = [];
                    display[trait_class_id].push([LastTrait, trait_box]);  // 格式：原来的, 现在的
                    display_num += 1;
                }
            } else if (!Dynamicest.First) {
                if (!display.hasOwnProperty(trait_class_id)) display[trait_class_id] = [];
                display[trait_class_id].push([trait_box, trait_box]);  // 格式：都是现在的，这个是新特质的出现
                display_num += 1;
            };
            NewTraits[trait_title] = trait_box.cloneNode(true);  // 不论前一个是否存在，都要保存；存快照防止弹窗动画改写元素导致重复弹出
        }
    }

    Dynamicest.LastTraits = NewTraits;

    if (display_num > Dynamicest.DisplayFoldMax) {
        Dynamicest.DisplayFold["traits"] = display;
    } else {
        for (const trait_class_id in display) {
            const traits = display[trait_class_id]
            Dynamicest.EnqueueShow(trait_class_id, "traits", (list) => {
                traits.forEach(([, NewTrait]) => list.append(NewTrait));
            }, () => {
                traits.forEach(([LastTrait, NewTrait]) => Dynamicest.applyTransition(LastTrait, NewTrait));
                Dynamicest.FinishList(trait_class_id, 1500)
            });
        }
    }
};

// === 日志动态 =================================
Dynamicest.CheckJournal = function(key, id=null) {
    if (id && V.Dynamicest.Settings.FilterJournals.includes(id)) return false;

    if (!Dynamicest.LastJournals.hasOwnProperty(key) || V[key] === undefined) {
        Dynamicest.LastJournals[key] = V[key];
        return false;
    } else if (Dynamicest.LastJournals[key] !== V[key]) {
        if (id) Dynamicest.LastJournalsID[id] = undefined;
        Dynamicest.CheckedOld = Dynamicest.LastJournals[key];  // 记录旧值，供数字缓动插值使用
        Dynamicest.LastJournals[key] = V[key];
        return true;
    }
    return false;
};

Dynamicest.LoadJournals = function() {
    const Journals = [];

    if (Dynamicest.CheckJournal("blackmoney", "赃物")) Journals.push({text: `<<highicon>>价值<span class="green">£<<print $blackmoney>></span>的赃物，你可以在黑市上将它们卖掉。`, value: [Dynamicest.CheckedOld, V.blackmoney]});
    if (Dynamicest.CheckJournal("antiquemoney", "古董")) Journals.push({text: `<<museumicon>>价值<span class="green">£<<print $antiquemoney>></span>的古董，你可以将它们卖给博物馆。`, value: [Dynamicest.CheckedOld, V.antiquemoney]});
    if (Dynamicest.CheckJournal("phials_held", "催情剂")) Journals.push({text: `<<icon "aphrodisiac.png">><span class="green">$phials_held</span>罐<<pluralise $phials_held "催情剂">>，你可以在麋鹿街出售<<pluralise $phials_held "它" "它们">>。`, value: [Dynamicest.CheckedOld, V.phials_held]});
    if (Dynamicest.CheckJournal("lurkers_held", "潜伏者")) Journals.push({text: `<<birdicon "lurkers">><span class="green">$lurkers_held</span>个<<pluralise $lurkers_held "潜伏者">>。`, value: [Dynamicest.CheckedOld, V.lurkers_held]});
    if (Dynamicest.CheckJournal("milkshake", "奶昔")) Journals.push({text: `<<foodicon "milkshake">><span class="green">$milkshake</span>杯<<pluralise $milkshake "奶昔">>。`, value: [Dynamicest.CheckedOld, V.milkshake]});
    if (Dynamicest.CheckJournal("popcorn", "爆米花")) Journals.push({text: `<<foodicon "popcorn">><span class="green">$popcorn</span><<pluralise $popcorn "包">>爆米花。`, value: [Dynamicest.CheckedOld, V.popcorn]});
    if (Dynamicest.CheckJournal("panties_held", "偷来的内衣")) Journals.push({text: `<span class="clothes-white"><<icon "clothes/plain_panties.png">></span> <<print $panties_held is 1 ? "一件" : "<span class='green'>$panties_held</span>件">>偷来的内衣。你可以在午餐时间到后操场出售<<pluralise $panties_held "它" "它们">>。`, value: [Dynamicest.CheckedOld, V.panties_held]});

    if (Dynamicest.CheckJournal("sciencelichenpark", "科学研究项目")) if (V.sciencelichenpark === 1 && V.sciencelichenparkready === 0) {Journals.push(`<span class='fa-icon fa-unselected'></span>你已经找到公园的地衣了，你需要在家或图书馆里把它记录到你的项目中。`)};
    if (Dynamicest.CheckJournal("sciencelichentemple", "科学研究项目")) if (V.sciencelichentemple === 1 && V.sciencelichentempleready === 0) {Journals.push(`<span class='fa-icon fa-unselected'></span>你已经找到了神殿中的地衣，你需要在家或图书馆里把它记录到你的项目中。`)};
    if (Dynamicest.CheckJournal("sciencelichendrain", "科学研究项目")) if (V.sciencelichendrain === 1 && V.sciencelichendrainready === 0) {Journals.push(`<span class='fa-icon fa-unselected'></span>你已经找到了下水道中的地衣，你需要在家或图书馆里把它记录到你的项目中。`)};
    if (Dynamicest.CheckJournal("sciencelichenlake", "科学研究项目")) if (V.sciencelichenlake === 1 && V.sciencelichenlakeready === 0) {Journals.push(`<span class='fa-icon fa-unselected'></span>你找到了生长在湖底废墟中的地衣，你需要在家或图书馆里把它记录到你的项目中。`)};
    if (Dynamicest.CheckJournal("scienceshroomheart", "科学研究项目")) if (V.scienceshroomheart) {Journals.push({text: `<span @class="($scienceshroomheart is 5 ? 'fa-icon fa-selected' : 'fa-icon fa-unselected')"></span><span @class="$scienceshroomheart is 0 and $scienceshroomheartready is 0 ? 'black' : ''"> $scienceshroomheart/5 的心形蘑菇已被发现。</span>`, value: [Dynamicest.CheckedOld, V.scienceshroomheart]})};
    if (Dynamicest.CheckJournal("scienceshroomwolf", "科学研究项目")) if (V.scienceshroomwolf) {Journals.push({text: `<span @class="($scienceshroomwolf is 5 ? 'fa-icon fa-selected' : 'fa-icon fa-unselected')"></span><span @class="$scienceshroomwolf is 0 and $scienceshroomwolfready is 0 ? 'black' : ''"> $scienceshroomwolf/5 的狼菇已被发现。</span>`, value: [Dynamicest.CheckedOld, V.scienceshroomwolf]})};
    if (Dynamicest.CheckJournal("sciencephallus", "科学研究项目")) if (V.sciencephallus) {Journals.push({text: `<span @class="($sciencephallus is 10 ? 'fa-icon fa-selected' : 'fa-icon fa-unselected')"></span> $sciencephallus/10 的性器已测量。`, value: [Dynamicest.CheckedOld, V.sciencephallus]})};

    // 单独适配智能手机
    if (!V.Dynamicest.Settings.FilterJournals.includes("获得手机")) {
        if (window.PhoneMod) {
            const phones = V.Phone?.Owned ? V.Phone.Owned.map(item => item.id): null;
            if (phones) {
                phones.forEach(phoneid => {
                    if (Dynamicest.LastJournals["Phone.Owned"] && !Dynamicest.LastJournals["Phone.Owned"].contains(phoneid)) {
                        const phone = V.Phone.Owned.find(item => item.id === phoneid);
                        const info = window.PhoneMod?.getPhoneConditionInfo(phone);
                        Journals.push(`
                            <<if ${phone.newnessmax > 0}>>
                                [ ${window.PhoneMod?.getPhoneBattery(phone)}% ] 
                            <<else>>
                                [ --- ] 
                            <</if>>
                            一部${info.html}的 ${phone.model} ，官网售价为
                            <span class='gold'>£${Math.round(window.PhoneMod?.getPhoneInfo(phone.model).price)}</span>。
                            <<if ${phone.stolen}>>
                                <span class='red'>盗窃得来</span>
                                <<if ${phone.usable}>>
                                    <span class='yellow'>密码已重置</span>
                                <<else>>
                                    <span class='red'>密码未知</span>
                                <</if>>
                            <<else>>
                                <<if ${phone.second}>>
                                    <span class='yellow'>地下手机店购买</span>
                                <<else>>
                                    <span class='green'>官方渠道购买</span>
                                <</if>>
                            <</if>>`);
                    }
                });
                Dynamicest.LastJournalsID["获得手机"] = undefined;
                Dynamicest.LastJournals["Phone.Owned"] = phones;
            }
        }
    };

    if (Journals.length > 0) {
        const divs = [];
        Dynamicest.EnqueueShow("Journal", "traits", (list) => {
            Journals.forEach(Journal => {
                if (Journal.text === undefined) Journal = {text: Journal};
                const JournalDiv = document.createElement("div");
                JournalDiv.className = "trait box-dynamicest-stretch";
                new Wikifier(JournalDiv, Journal.text);
                divs.push([JournalDiv, Journal.value]);
                list.append(JournalDiv);
            })
        }, () => {
            divs.forEach(([JournalDiv, value]) => {
                if (value) Dynamicest.easeTextValue(JournalDiv, value[0], value[1]);
            })
            Dynamicest.FinishList("Journal", 2500);
        });
    }
};

// === 侧栏动态 =================================
Dynamicest.LoadSides = function() {
    if (!V.Dynamicest.Settings.EnableSides) return;

    const Sides = [];
    const container = document.querySelector('#storyCaptionContent');
    const targetElement = document.querySelector('#sidebar-look-description');
    const elementsList = [];

    if (container && targetElement) {
        const children = container.children;
        for (let child of children) {
            if (child === targetElement) break;
            if (!["<br>"].contains(child.outerHTML)) {
                elementsList.push(child.innerHTML);
                if (!Dynamicest.LastSides.contains(child.innerHTML)) {
                    Sides.push(child.outerHTML);
                }
            }
        }
    }

    if (Sides.length > 0) {
        Dynamicest.EnqueueShow("Side", "traits", (list) => {
            Sides.forEach(SideHtml => {
                const SideDiv = document.createElement("div");
                SideDiv.className = "trait box-dynamicest-stretch";
                SideDiv.innerHTML = SideHtml;
                list.append(SideDiv);
            })
        }, () => {
            Dynamicest.FinishList("Side", 2500);
        });
    }

    Dynamicest.LastSides = elementsList;
    Dynamicest.LastSides.forEach(v => Dynamicest.HistorySides.add(v));
};

// === 其他动态 =================================
Dynamicest.CheckValue = function(key, value) {
    if (!Dynamicest.LastValues.hasOwnProperty(key) || value === undefined) {
        Dynamicest.LastValues[key] = value;
        return false;
    }
    if (Dynamicest.LastValues[key] !== value) {
        Dynamicest.CheckedOld = Dynamicest.LastValues[key];  // 记录旧值，供数字缓动插值使用
        Dynamicest.LastValues[key] = value;
        return true;
    }
    return false;
};

Dynamicest.LoadValues = function() {
    const Values = [];
    const funcs = [];

    if (!V.Dynamicest.Settings.FilterComdoms && Dynamicest.CheckValue("condoms", V.condoms)) Values.push({text: `
        <div style="display: flex">
            <span class='meek' style="flex: 1; padding-left: 0.2em; text-align: left;">避孕套总数：$condoms</span>
            <img draggable="false" src="img/ui/condom.png">
        </div>`, value: [Dynamicest.CheckedOld, V.condoms]});

    if (!V.Dynamicest.Settings.FilterSpray && Dynamicest.CheckValue("spray", V.spray)) Values.push({text: `
        <div style="display: flex">
            <span class='def' style="flex: 1; padding-left: 0.2em; text-align: left;">防狼喷雾：$spray / $spraymax</span>
            <div style="display: flex;">
                <<for _i to 1; _i lte $spraymax; _i++>>
                    <<if $spray gte _i>>
                        <img draggable="false" src="img/ui/pepper-spray.png">
                    <<else>>
                        <img draggable="false" src="img/ui/empty-spray.png">
                    <</if>>
                <</for>>
            </div>
        </div>`, value: [Dynamicest.CheckedOld, V.spray]});

    if (!V.Dynamicest.Settings.FilterBodyTemperature && Dynamicest.CheckValue("bodyTemperature", setup.WeatherDescriptions.bodyTemperature()+setup.WeatherDescriptions.bodyTemperatureChanges())) {
        Values.push(`<div id="characterTemperatureDynamicest"><canvas width="32" height="24"></canvas></div>${setup.WeatherDescriptions.bodyTemperature()}<br>${setup.WeatherDescriptions.bodyTemperatureChanges()}`);
        funcs.push(() => {
            const characterTemperature = document.querySelector("#characterTemperature>canvas");
            if (characterTemperature) {
                document.querySelector("#characterTemperatureDynamicest>canvas").getContext('2d').drawImage(
                    characterTemperature,
                    0, 0,
                    characterTemperature.width, characterTemperature.height,
                );
            }
        })
    }

    if (!V.Dynamicest.Settings.FilterOutside && Dynamicest.CheckValue("outside", V.outside))  Values.push(`
        <div>
            <img class="icon_ui" src="img/ui/sidebar-${V.outside ? "open" : "closed"}.png" style="${V.outside ? "transform: translateY(25%);" : ""}"> 
            <span>
                ${V.outside ? "<<possessedWord '你'>>在室外。" : "<<possessedWord '你'>>在室内。"}
            </span>
        </div>`);

    if (Values.length > 0) {
        const divs = [];
        Dynamicest.EnqueueShow("Value", "traits box-dynamicest-half", (list) => {
            Values.forEach(Value => {
                if (Value.text === undefined) Value = {text: Value};
                const ValueDiv = document.createElement("div");
                ValueDiv.className = "trait box-dynamicest-stretch";
                new Wikifier(ValueDiv, Value.text);
                divs.push([ValueDiv, Value.value]);
                list.append(ValueDiv);
            })

            funcs.forEach(func => func())
        }, () => {
            divs.forEach(([ValueDiv, value]) => {
                if (value) Dynamicest.easeTextValue(ValueDiv, value[0], value[1]);
            })
            Dynamicest.FinishList("Value", 2500);
        });
    }
};

// === 折叠动态 =================================
Dynamicest.LoadFoldedDisplay = function() {
    if (Object.keys(Dynamicest.DisplayFold).length > 0) {
        Dynamicest.EnqueueShow("foldedDisplay", "foldedDisplay-box-list", (list) => {
            list.innerHTML = `
            <div onclick="Dynamicest.UnfoldDisplay()">
                <span id="foldedDisplay">查看所有数值的改变</span>
            </div>
            `;
        }, () => {
            Dynamicest.FinishList("foldedDisplay", 5000);
        });
    }
};
Dynamicest.UnfoldDisplay = function() {
    if (!Dynamicest.DisplayFoldClose && Dynamicest.CancelFinishList("foldedDisplay")) {
        const foldedDisplay = document.querySelector("#foldedDisplay");
        if (foldedDisplay) foldedDisplay.innerText = "关闭所有数值的改变";
        document.documentElement.style.setProperty('--dynamicest-display-penetrate', 'all');
        Dynamicest.DisplayFoldClose = true;

        for (let key in Dynamicest.DisplayFold) {
            let display = Dynamicest.DisplayFold[key]
            for (const class_id in display) {
                const divs = display[class_id];
                Dynamicest.EnqueueShow(class_id, key, (list) => {
                    divs.forEach(([, New]) => list.append(New));
                }, () => {
                    divs.forEach(([Last, New]) => Dynamicest.applyTransition(Last, New));
                });
            }
        }
        Dynamicest.RunShowQueue();  // 入队完毕，凑满第一批无需等待直接弹出
    } else {
        Dynamicest.settingDynamicestDisplay();
        Dynamicest.FinishList("foldedDisplay", -800);
        for (let key in Dynamicest.DisplayFold) {
            let display = Dynamicest.DisplayFold[key]
            for (const class_id in display) {
                Dynamicest.FinishList(class_id, -800);
            }
        }
    }
};

// === 时间进度条 ===============================
// 24段日进度条：0点在底部随时间向上点亮；各时段自带晨昏基色，未到的时段以低透明度打底
Dynamicest.TimeBarHour = null;  // 上次渲染的小时数
Dynamicest.TimeBarStamp = null;  // 上次渲染的时间戳（Time.date.timeStamp），用于区分跨午夜与回溯
Dynamicest.TimeBarTimer = null;  // 跨天二段动画（烧尽）的调度

Dynamicest.hourColor = function(h) {
    return h < 6 ? "#4f6ab5" : h < 9 ? "#d98a44" : h < 17 ? "#e5c04b" : h < 20 ? "#d4693f" : "#4f6ab5";
};

// 生成分段HTML：popFrom为依次爆闪点亮的起始时段，topped为冲顶全亮，roll为跨天烧尽复亮
Dynamicest.timeBarHTML = function(hour, minute, popFrom, roll, topped) {
    const dim = (hex) => {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},0.16)`;
    };
    let html = "";
    for (let h = 0; h < 24; h++) {
        const color = Dynamicest.hourColor(h);
        let style = `--dynamicest-hour-color:${color};--dynamicest-hour-dim:${dim(color)};`;
        let class_ = "dynamicest-tseg";
        if (topped || h < hour) {  // 冲顶时全条点亮
            class_ += " lit";
            if (popFrom !== null && h >= popFrom) {  // 新点亮的时段依次爆闪，一次跳过数小时则形成级联
                class_ += " pop";
                style += `animation-delay:${(h - popFrom) * 80}ms;`;
            }
        } else if (h === hour) {
            class_ += " charging";
        }
        if (roll) {  // 跨天：从下往上烧尽，已过时段再缓缓复亮
            class_ += " reset";
            style += `animation-delay:${h * 80}ms;`;
        }
        html += `<div class="${class_}" style="${style}">`;
        if (!topped && h === hour) html += `<div class="dynamicest-tseg-fill${popFrom !== null ? " zap" : ""}" style="height:${Math.round(minute / 60 * 100)}%"></div>`;
        html += `</div>`;
    }
    return html;
};

// 将进度条挂入侧边栏右缘（收起/展开共用同一根，悬在侧边栏与正文之间）
Dynamicest.updateTimeBar = function() {
    if (typeof Time === "undefined" || !Number.isFinite(Time.hour) || !Number.isFinite(Time.minute)) return;
    const uiBar = document.getElementById("ui-bar");
    if (!uiBar) return;
    let bar = uiBar.querySelector(".dynamicest-timebar");
    if (!bar) {
        uiBar.insertAdjacentHTML("beforeend", `<div class="dynamicest-timebar" tooltip="一天时间进度 · 每格一小时"></div>`);
        bar = uiBar.querySelector(".dynamicest-timebar");
    }

    const hour = Time.hour, minute = Time.minute, stamp = Time.date.timeStamp;
    const prev = Dynamicest.TimeBarHour;
    const prevStamp = Dynamicest.TimeBarStamp;
    Dynamicest.TimeBarHour = hour;
    Dynamicest.TimeBarStamp = stamp;

    const forward = prev !== null && stamp > prevStamp;  // 时间在前进（排除存档回溯/倒带）
    const dayRoll = forward && hour < prev;  // 小时回卷但时间在前进 = 跨过午夜
    const advanced = forward && !dayRoll && hour > prev;  // 同日跨过整点

    if (dayRoll) {
        // 第一段：先按原方式从睡前进度依次爆闪点亮到满格（冲顶）
        bar.className = "dynamicest-timebar kick";
        bar.innerHTML = Dynamicest.timeBarHTML(23, 59, prev, false, true);
        bar.dataset.h = hour;
        // 第二段：冲顶完成后整条从下往上烧尽，已过时段再缓缓复亮
        // 触发点对齐最后一段爆闪的尾巴（(23-prev)*80+500ms 处结束），不留空等也不截断动画
        Dynamicest.TimeBarTimer = setTimeout(() => {
            const rollBar = document.querySelector("#ui-bar .dynamicest-timebar");
            if (!rollBar || typeof Time === "undefined") return;
            rollBar.className = "dynamicest-timebar";
            rollBar.innerHTML = Dynamicest.timeBarHTML(Time.hour, Time.minute, null, true, false);
            rollBar.dataset.h = Time.hour;
        }, (24 - prev) * 80 + 430);
    } else if (bar.dataset.h !== String(hour)) {  // 整点变化或首次构建时重建全部分段
        bar.className = `dynamicest-timebar${advanced ? " kick" : ""}`;
        bar.innerHTML = Dynamicest.timeBarHTML(hour, minute, advanced ? prev : null, false, false);
        bar.dataset.h = hour;
    } else if (bar.querySelector(".dynamicest-tseg-fill")) {  // 同一小时内仅更新充电进度，不重启动画
        bar.querySelector(".dynamicest-tseg-fill").style.height = `${Math.round(minute / 60 * 100)}%`;
    }
};

// === 设置 ====================================
Dynamicest.getFilterObj = function(slot) {
    let obj1 = []
    let obj2 = {}
    switch (slot) {
        case "Journals":
            obj1 = V.Dynamicest.Settings.FilterJournals;
            obj2 = Dynamicest.LastJournalsID;
            break;
        case "Characteristics":
            obj1 = V.Dynamicest.Settings.FilterCharacteristics;
            obj2 = Dynamicest.LastCharacteristics;
            break;
        case "Relations":
            obj1 = V.Dynamicest.Settings.FilterRelations;
            obj2 = Dynamicest.LastRelations;
            break;
        case "Traits":
            obj1 = V.Dynamicest.Settings.FilterTraits;
            obj2 = Dynamicest.LastTraits;
            break;
        case "Sides":
            obj1 = V.Dynamicest.Settings.FilterSides;
            obj2 = {};
            Dynamicest.HistorySides.forEach(value => {
                obj2[value] = undefined
            })
            break;
        default:
            break;
    };
    return [obj1, obj2]
};
Dynamicest.settingFilter = function(slot, key, checked) {
    const [obj, _] = Dynamicest.getFilterObj(slot);
    if (checked) {
        obj.push(key);
    } else {
        V.Dynamicest.Settings[`Filter${slot}`] = obj.filter(i => i != key);
    };
}
Dynamicest.getFilterOptions = function(slot) {
    const [obj1, obj2] = Dynamicest.getFilterObj(slot);
    return [...new Set([...obj1, ...Object.keys(obj2)])];
}
Dynamicest.getFilter = function(slot, key) {
    const [obj, _] = Dynamicest.getFilterObj(slot);
    return obj.includes(key) ? " checked" : "";
};

Dynamicest.settingDynamicestDisplay = function() {
    document.documentElement.style.setProperty('--dynamicest-display-top', `${V.Dynamicest.Settings.DynamicestDisplayTop}px`);
    document.documentElement.style.setProperty('--dynamicest-display-scale', `${V.Dynamicest.Settings.DynamicestDisplayScale}`);
    document.documentElement.style.setProperty('--dynamicest-display-opacity', `${V.Dynamicest.Settings.DynamicestDisplayOpacity}`);
    document.documentElement.style.setProperty('--dynamicest-display-penetrate', `${(V.Dynamicest.Settings.DynamicestDisplayPenetrate&&!Dynamicest.Debug) ? "none": "all"}`);
};
Dynamicest.settingDynamicestDisplayApply = function() {
    Dynamicest.settingDynamicestDisplay()
};
Dynamicest.settingDynamicestDisplayReset = function() {
    V.Dynamicest.Settings.DynamicestDisplayTop = 10;
    V.Dynamicest.Settings.DynamicestDisplayScale = 1.0;
    V.Dynamicest.Settings.DynamicestDisplayOpacity = 1.0;
    document.getElementById("numberslider-input-dynamicestsettingsdynamicestdisplaytop").value = V.Dynamicest.Settings.DynamicestDisplayTop;
    document.getElementById("numberslider-value-dynamicestsettingsdynamicestdisplaytop").innerText = V.Dynamicest.Settings.DynamicestDisplayTop;
    document.getElementById("numberslider-input-dynamicestsettingsdynamicestdisplayscale").value = V.Dynamicest.Settings.DynamicestDisplayScale;
    document.getElementById("numberslider-value-dynamicestsettingsdynamicestdisplayscale").innerText = V.Dynamicest.Settings.DynamicestDisplayScale;
    document.getElementById("numberslider-input-dynamicestsettingsdynamicestdisplayopacity").value = V.Dynamicest.Settings.DynamicestDisplayOpacity;
    document.getElementById("numberslider-value-dynamicestsettingsdynamicestdisplayopacity").innerText = V.Dynamicest.Settings.DynamicestDisplayOpacity;

    V.Dynamicest.Settings.DynamicestDisplayDuration = 800;
    document.getElementById("numberslider-input-dynamicestsettingsdynamicestdisplayduration").value = V.Dynamicest.Settings.DynamicestDisplayDuration;
    document.getElementById("numberslider-value-dynamicestsettingsdynamicestdisplayduration").innerText = V.Dynamicest.Settings.DynamicestDisplayDuration;

    Dynamicest.settingDynamicestDisplay()
};
