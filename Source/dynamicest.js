window.Dynamicest = {}

// === 数值存储 =================================
Dynamicest.First = true;
Dynamicest.Finish = [];
Dynamicest.DisplayFold = {};
Dynamicest.DisplayFoldMax = 5;
Dynamicest.DisplayFoldClose = false;
Dynamicest.LastMoney = null;
Dynamicest.LastState = new Map();
Dynamicest.LastCharacteristics = {};
Dynamicest.LastRelations = {};
Dynamicest.LastTraits = {};


// === 注入 =====================================
$(document).on(":passagerender", function (ev) {Dynamicest.onPassageRender(ev)});
Dynamicest.onPassageRender = function (ev) {

    // === 数值存储存档 ==============================
    V.Dynamicest = V.Dynamicest || {};

    // 设置
    V.Dynamicest.Settings = V.Dynamicest.Settings || {};
    V.Dynamicest.Settings.FilterRelations = V.Dynamicest.Settings.FilterRelations || ["巨鹰 恐怖者"];
    V.Dynamicest.Settings.FilterCharacteristics = V.Dynamicest.Settings.FilterCharacteristics || [];
    V.Dynamicest.Settings.FilterTraits = V.Dynamicest.Settings.FilterTraits || ["防晒霜"];

    V.Dynamicest.DynamicestDisplayTop = V.Dynamicest.Settings.DynamicestDisplayTop || 10;
    Dynamicest.settingDynamicestDisplayTop();

    V.Dynamicest.Avatar = true;
    V.Dynamicest.AvatarScale = V.Dynamicest.AvatarScale || 1;
    V.Dynamicest.AvatarShowBorder = V.Dynamicest.AvatarShowBorder || false;
    V.Dynamicest.AvatarZ = V.Dynamicest.AvatarZ || 299;
    V.Dynamicest.AvatarX = V.Dynamicest.AvatarX || -100;
    V.Dynamicest.AvatarY = V.Dynamicest.AvatarY || -100;
    V.Dynamicest.AvatarStoryBottom = V.Dynamicest.AvatarStoryBottom || 100;
    Dynamicest.settingStoryBottom();
    V.Dynamicest.Locked = V.Dynamicest.Locked || false;

    // 不允许首页出现，因为会导致首次判断出错
    if (V.passage === "Start") return;
    Dynamicest.ev = ev;
    Dynamicest.DisplayFold = {};
    Dynamicest.DisplayFoldClose = false;

    queueMicrotask(() => {
        Dynamicest.LoadStats();
        Dynamicest.LoadAvatar();
        Dynamicest.LoadMoney();

        const runTask = (task) => {
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    task();
                    resolve();
                });
            });
        };
        
        runTask(() => runTask(() => Dynamicest.LoadSocial()))
            .then(() => runTask(() => Dynamicest.LoadCharacteristics()))
            .then(() => runTask(() => Dynamicest.LoadTrait()))
            .then(() => runTask(() => {
                Dynamicest.First = false;
                Dynamicest.LoadFoldedDisplay();
            }));
    });
};

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
        
        const list = Dynamicest.GetList("money", "money-box-list");
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
        
        // 启动动画
        setTimeout(() => {
            this.animateMoneyChange(lastMoney, newMoney, relMoneyAbs, isPositive);
        }, 1000);

        Dynamicest.FinishList("money", 2000);
    }
    Dynamicest.LastMoney = V.money;
};

// === 状态动态 =================================
Dynamicest.LoadStats = function() {
    const stowed = document.getElementById("ui-bar").classList.contains("stowed")
    const stats = document.querySelectorAll('#statmeters > div');
    const mobileStats = document.querySelectorAll('#mobileStats .stat');

    stats.forEach(stat => {
        const stat_id = stat.id
        let stat_title = stat.title

        stat_title = stat_title.replace("醉意", "醉酒")  // 单独适配醉意
        stat_title = stat_title.replace("药物", "麻醉")  // 单独适配药物

        try {
            let meter = stat.querySelector(".meter")
            if (!meter) {
                console.log(`[状态美化错误] ${stat_id} 找不到meter: ${stat.getHTML()}`);
                return
            }
            let bar = meter.querySelector("div")
            const newclassname = bar? bar.className: '';
            const newWidth = bar? bar.style.width: '0%';
            let lastclassname = '';
            let lastWidth = '0%';
            if (Dynamicest.LastState.has(stat_id)) {
                lastclassname = Dynamicest.LastState.get(stat_id)[0];
                lastWidth = Dynamicest.LastState.get(stat_id)[1];
            }

            // 没有bar了：可能是为值零，不显示了
            if (!bar) {
                const div = document.createElement("div")
                div.style.width = '0%'
                meter.append(div)
                bar = div
            }

            // 寻找移动stat
            const mobile_stat = mobileStats.find(i => {
                const mobile_stat = mobileStats[i]
                const span = mobile_stat.querySelector("mouse > span")
                if (span) {
                    return span.innerText === stat_title
                } else {
                    return false
                }
            })
            let mobile_stat_bar = null

            // 创建移动stat条（如果有）
            if (mobile_stat) {
                const div_meter = document.createElement("div")
                div_meter.className = "meter"
                const div = document.createElement("div")
                div.className = newclassname
                div.style.width = bar.style.width
                div_meter.append(div)
                mobile_stat.append(div_meter)
                mobile_stat_bar = div

                if (stowed) {
                    bar = mobile_stat_bar
                }
            }
            
            //  动态更改
            if (lastWidth !== newWidth) {
                bar.style.transition = 'none';
                bar.className = lastclassname
                bar.style.width = lastWidth;

                bar.offsetHeight;
                
                bar.style.transition = '';
                bar.className = newclassname
                bar.style.width = newWidth;
            }

            Dynamicest.LastState.set(stat_id, [newclassname, newWidth]);
        } catch (err)  {
            console.log(`[状态美化错误] ${stat_id} ${err}:  ${stat.getHTML()}`);
        }
    })
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
    (list => setTimeout(() => {list.classList.remove("dynamicest-hide")}, 100))(list);
    display.append(list);
    return list
};
Dynamicest.FinishList = function(id, delay) {
    id = id.trim();
    let list = document.querySelector(`#box-dynamicest-list-${id}`);
    Dynamicest.Finish.push(id);
    if (list) {
        setTimeout(() => {
            if (Dynamicest.Finish.includes(id)) {
                list.classList.add("dynamicest-hide");
                setTimeout(() => list.remove(), 800);
                Dynamicest.Finish.splice(Dynamicest.Finish.indexOf(id), 1);
            }
        }, delay+800);
    };
};
Dynamicest.CancelFinishList = function(id) {
    if (Dynamicest.Finish.includes(id)) {
        Dynamicest.Finish.splice(Dynamicest.Finish.indexOf(id), 1);
        return true;
    }
    return false;
};
Dynamicest.applyTransition = function(oldElement, newElement) {
    // 递归比较两个元素的子节点
    const compareAndAnimate = (oldNode, newNode) => {
        if (!oldNode || !newNode || oldNode.nodeType !== 1 || newNode.nodeType !== 1) return;
        
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
                        console.log(prop, value);
                        
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

// === 社交动态 =================================
Dynamicest.LoadSocial = function() {
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
                if (LastRelation.innerText !== relation_box.innerText) {  // 有改动，动态展示，否则不变
                    if (!display.hasOwnProperty(relation_class_id)) display[relation_class_id] = [];
                    display[relation_class_id].push([LastRelation, relation_box]);  // 格式：原来的, 现在的
                    display_num += 1;
                }
            } else if (!Dynamicest.First) {
                if (!display.hasOwnProperty(relation_class_id)) display[relation_class_id] = [];
                display[relation_class_id].push([relation_box, relation_box]);  // 格式：都是现在的，这个是新NPC的出现
                display_num += 1;
            };
            NewRelations[relation_title] = relation_box;  // 不论前一个是否存在，都要保存
        }
    }

    Dynamicest.LastRelations = NewRelations;

    if (display_num > Dynamicest.DisplayFoldMax) {
        Dynamicest.DisplayFold["relation-box-list"] = display;
    } else {
        for (const relation_class_id in display) {
            const relations = display[relation_class_id]
            for (let index = 0; index < relations.length; index++) {
                const [LastRelation, NewRelation] = relations[index];
                const list_div = Dynamicest.GetList(relation_class_id, "relation-box-list");
                list_div.append(NewRelation);
                Dynamicest.applyTransition(LastRelation, NewRelation);
            }
            Dynamicest.FinishList(relation_class_id, 800)
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
            NewCharacteristics[characteristic_title] = characteristic_box  // 不论前一个是否存在，都要保存
        }
    };

    Dynamicest.LastCharacteristics = NewCharacteristics;

    if (display_num > Dynamicest.DisplayFoldMax) {
        Dynamicest.DisplayFold["characteristic-box-list"] = display
    } else {
        for (const characteristic_class_id in display) {
            const characteristics = display[characteristic_class_id]
            for (let index = 0; index < characteristics.length; index++) {
                const [LastCharacteristic, NewCharacteristic] = characteristics[index];
                const list_div = Dynamicest.GetList(characteristic_class_id, "characteristic-box-list");
                list_div.append(NewCharacteristic);
                Dynamicest.applyTransition(LastCharacteristic, NewCharacteristic);
            }
            Dynamicest.FinishList(characteristic_class_id, 800)
        }
    };
};

// === 特质动态 =================================
Dynamicest.LoadTrait = function() {
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
            NewTraits[trait_title] = trait_box;  // 不论前一个是否存在，都要保存
        }
    }

    Dynamicest.LastTraits = NewTraits;

    if (display_num > Dynamicest.DisplayFoldMax) {
        Dynamicest.DisplayFold["traits"] = display;
    } else {
        for (const trait_class_id in display) {
            const traits = display[trait_class_id]
            for (let index = 0; index < traits.length; index++) {
                const [LastTrait, NewTrait] = traits[index];
                const list_div = Dynamicest.GetList(trait_class_id, "traits");
                list_div.append(NewTrait);
                Dynamicest.applyTransition(LastTrait, NewTrait);
            }
            Dynamicest.FinishList(trait_class_id, 1500)
        }
    }
};

// === 折叠动态 =================================
Dynamicest.LoadFoldedDisplay = function() {
    if (Object.keys(Dynamicest.DisplayFold).length > 0) {
        const list = Dynamicest.GetList("foldedDisplay", "foldedDisplay-box-list");
        list.innerHTML = `
        <div onclick="Dynamicest.UnfoldDisplay()">
            <span id="foldedDisplay">查看所有数值的改变</span>
        </div>
        `;

        Dynamicest.FinishList("foldedDisplay", 5000);
    }
};
Dynamicest.UnfoldDisplay = function() {
    if (!Dynamicest.DisplayFoldClose && Dynamicest.CancelFinishList("foldedDisplay")) {
        const foldedDisplay = document.querySelector("#foldedDisplay");
        if (foldedDisplay) foldedDisplay.innerText = "关闭所有数值的改变";
        Dynamicest.DisplayFoldClose = true;

        for (let key in Dynamicest.DisplayFold) {
            let display = Dynamicest.DisplayFold[key]
            for (const class_id in display) {
                const divs = display[class_id];
                for (let index = 0; index < divs.length; index++) {
                    const [Last, New] = divs[index];
                    const list_div = Dynamicest.GetList(class_id, key);
                    list_div.append(New);
                    Dynamicest.applyTransition(Last, New);
                }
            }
        }
    } else {
        Dynamicest.FinishList("foldedDisplay", -800);
        for (let key in Dynamicest.DisplayFold) {
            let display = Dynamicest.DisplayFold[key]
            for (const class_id in display) {
                Dynamicest.FinishList(class_id, -800);
            }
        }
    }
};


// === 头像 ====================================
Dynamicest.LoadAvatar = function() {
    // 获取原始画布
    if (!Dynamicest.sourceCanvas) {
        Dynamicest.sourceCanvas = document.querySelector(".mainCanvas");
    }

    // 如果容器已存在，只更新配置
    if (Dynamicest.AvatarContainer) {
        this.updateAvatarConfig();
        return;
    }

    // 创建头像容器
    Dynamicest.AvatarContainer = document.createElement("div");
    Dynamicest.AvatarContainer.id = "avatar-container";
    Dynamicest.AvatarContainer.className = "avatar";
    Dynamicest.AvatarContainer.style.zIndex = V.Dynamicest.AvatarZ;
    Dynamicest.AvatarContainer.style.left = V.Dynamicest.AvatarX + "px";
    Dynamicest.AvatarContainer.style.bottom = V.Dynamicest.AvatarY + "px";
    document.querySelector('#story').append(Dynamicest.AvatarContainer);

    // 创建头像画布
    Dynamicest.AvatarCanvas = document.createElement("canvas");
    Dynamicest.AvatarCanvas.id = "avatar";
    Dynamicest.updateCanvasSize();
    Dynamicest.AvatarContainer.append(Dynamicest.AvatarCanvas);

    // 创建拖拽手柄
    Dynamicest.AvatarHandle = document.createElement("div");
    Dynamicest.AvatarHandle.id = "avatar-move";
    Dynamicest.AvatarHandle.style.inset = "14px 22px 79px 75px";
    Dynamicest.AvatarHandle.style.cursor = "move";
    Dynamicest.AvatarHandle.style.touchAction = "none";
    if (V.Dynamicest.Locked) Dynamicest.AvatarHandle.style.pointer_events = "none";
    Dynamicest.updateBorderDisplay();
    Dynamicest.AvatarContainer.append(Dynamicest.AvatarHandle);

    // 启动同步和拖拽
    Dynamicest.startSync();
    new DraggableAvatar();
};

Dynamicest.updateCanvasSize = function() {
    if (!Dynamicest.sourceCanvas || !Dynamicest.AvatarCanvas) return;
    Dynamicest.AvatarCanvas.width = Dynamicest.sourceCanvas.width * V.Dynamicest.AvatarScale;
    Dynamicest.AvatarCanvas.height = Dynamicest.sourceCanvas.height * V.Dynamicest.AvatarScale;
};

Dynamicest.updateBorderDisplay = function() {
    if (!Dynamicest.AvatarHandle) return;
    if (V.Dynamicest.AvatarShowBorder) {
        Dynamicest.AvatarHandle.style.border = "1px solid aqua";
    } else {
        Dynamicest.AvatarHandle.style.border = "none";
    }
};

Dynamicest.updateAvatarConfig = function() {
    if (!Dynamicest.AvatarContainer) return;
    Dynamicest.AvatarContainer.style.display = V.Dynamicest.Avatar ? "": "none"
    Dynamicest.AvatarContainer.style.zIndex = `${V.Dynamicest.AvatarZ}`;
    Dynamicest.AvatarContainer.style.left =  V.Dynamicest.AvatarX + "px";
    Dynamicest.AvatarContainer.style.bottom = V.Dynamicest.AvatarY + "px";
    Dynamicest.updateCanvasSize();
    Dynamicest.updateBorderDisplay();
};

Dynamicest.startSync = function() {
    function sync() {
        if (!Dynamicest.sourceCanvas || !Dynamicest.AvatarCanvas) return;
        
        const ctx = Dynamicest.AvatarCanvas.getContext('2d');
        ctx.clearRect(0, 0, Dynamicest.AvatarCanvas.width, Dynamicest.AvatarCanvas.height);
        ctx.drawImage(
            Dynamicest.sourceCanvas,
            0, 0,
            Dynamicest.sourceCanvas.width, Dynamicest.sourceCanvas.height,
            0, 0,
            Dynamicest.AvatarCanvas.width, Dynamicest.AvatarCanvas.height
        );
        
        Dynamicest.syncId = requestAnimationFrame(sync);
    }
    
    // 取消之前的同步
    if (Dynamicest.syncId) {
        cancelAnimationFrame(Dynamicest.syncId);
    }
    
    Dynamicest.syncId = requestAnimationFrame(sync);
};

Dynamicest.stopSync = function() {
    if (Dynamicest.syncId) {
        cancelAnimationFrame(Dynamicest.syncId);
        Dynamicest.syncId = null;
    }
};

class DraggableAvatar {
    constructor() {
        this.container = Dynamicest.AvatarContainer;
        this.handle = Dynamicest.AvatarHandle;
        this.isDragging = false;
        this.startPos = { x: 0, y: 0 };
        this.initialPos = { left: 0, bottom: 0 };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
    }
    
    bindEvents() {
        const handle = this.handle;
        
        // 鼠标事件
        handle.addEventListener('mousedown', this);
        document.addEventListener('mousemove', this);
        document.addEventListener('mouseup', this);
        
        // 触摸事件
        handle.addEventListener('touchstart', this, { passive: false });
        document.addEventListener('touchmove', this, { passive: false });
        document.addEventListener('touchend', this);
        document.addEventListener('touchcancel', this);
        
        // 阻止拖拽默认行为
        handle.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    // 事件处理
    handleEvent(e) {
        switch(e.type) {
            case 'mousedown':
            case 'touchstart':
                this.onDragStart(e);
                break;
            case 'mousemove':
            case 'touchmove':
                this.onDragMove(e);
                break;
            case 'mouseup':
            case 'touchend':
            case 'touchcancel':
                this.onDragEnd(e);
                break;
        }
    }
    
    getClientPos(e) {
        if (e.type.startsWith('touch')) {
            return {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        }
        return {
            x: e.clientX,
            y: e.clientY
        };
    }
    
    onDragStart(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const pos = this.getClientPos(e);
        const rect = this.container.getBoundingClientRect();
        
        this.isDragging = true;
        this.startPos = { x: pos.x, y: pos.y };
        const currentLeft = parseFloat(this.container.style.left) || rect.left;
        const currentBottom = parseFloat(this.container.style.bottom) || (window.innerHeight - rect.bottom);
        
        this.initialPos = { 
            left: currentLeft, 
            bottom: currentBottom 
        };
        
        this.handle.style.cursor = 'grabbing';
    }
    
    onDragMove(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const pos = this.getClientPos(e);
        const dx = pos.x - this.startPos.x;
        const dy = pos.y - this.startPos.y;
        
        // 计算新位置
        let newLeft = this.initialPos.left + dx;
        let newBottom = this.initialPos.bottom - dy;
        
        // 应用新位置
        this.container.style.left = newLeft + 'px';
        this.container.style.bottom = newBottom + 'px';
        this.container.style.top = 'auto';
        this.container.style.right = 'auto';
    }
    
    onDragEnd(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.handle.style.cursor = 'move';
        
        // 保存位置到存档变量
        const rect = this.container.getBoundingClientRect();
        V.Dynamicest.AvatarX = Math.round(rect.left);
        V.Dynamicest.AvatarY = Math.round(window.innerHeight - rect.bottom);
    }
}


// === 设置 ====================================
Dynamicest.settingFilter = function(slot, key, checked) {
    console.log(slot, key, checked);
    
    let obj = {}
    switch (slot) {
        case "Characteristics":
            obj = V.Dynamicest.Settings.FilterCharacteristics
            break;
        case "Relations":
            obj = V.Dynamicest.Settings.FilterRelations
            break;
        case "Traits":
            obj = V.Dynamicest.Settings.FilterTraits
            break;
        default:
            break;
    };

    if (checked) {
        obj.push(key);
    } else {
        V.Dynamicest.Settings[`Filter${slot}`] = obj.filter(i => i != key);
    };
}
Dynamicest.getFilterOptions = function(slot) {
    let obj1 = {}
    let obj2 = {}
    switch (slot) {
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
        default:
            break;
    };

    return [...new Set([...obj1, ...Object.keys(obj2)])];
}
Dynamicest.getFilter = function(slot, key) {
    let obj = {}
    switch (slot) {
        case "Characteristics":
            obj = V.Dynamicest.Settings.FilterCharacteristics
            break;
        case "Relations":
            obj = V.Dynamicest.Settings.FilterRelations
            break;
        case "Traits":
            obj = V.Dynamicest.Settings.FilterTraits
            break;
        default:
            break;
    };

    return obj.includes(key) ? " checked" : "";
};

Dynamicest.settingDynamicestDisplayTop = function(a0) {
    if (a0) {
        V.Dynamicest.DynamicestDisplayTop = a0;
        document.getElementById("numberslider-input-dynamicestdisplaytop").value = a0;
        document.getElementById("numberslider-value-dynamicestdisplaytop").innerText = a0;
    }
    document.documentElement.style.setProperty('--dynamicest-display-top', `${V.Dynamicest.DynamicestDisplayTop}px`);
};

Dynamicest.settingAvatarEnable = function(a0) {
    V.Dynamicest.Avatar = a0;
    Dynamicest.updateAvatarConfig();
    if (a0) {
        Dynamicest.startSync();
    } else {
        Dynamicest.stopSync();
    }
};
Dynamicest.settingAvatarShowBorder = function(a0) {
    V.Dynamicest.AvatarShowBorder = a0;
    Dynamicest.updateBorderDisplay();
};
Dynamicest.settingResetPos = function() {
    V.Dynamicest.AvatarX = -100;
    V.Dynamicest.AvatarY = -100;
    Dynamicest.updateAvatarConfig();
};
Dynamicest.settingLock = function(a0) {
    V.Dynamicest.Locked = a0
    if (V.Dynamicest.Locked) {
        Dynamicest.AvatarHandle.style.pointerEvents = "none";
    } else {
        Dynamicest.AvatarHandle.style.pointerEvents = "";
    }
};
Dynamicest.settingAvatarScale = function(a0) {
    if (a0) {
        V.Dynamicest.AvatarScale = a0;
        document.getElementById("numberslider-input-dynamicestavatarscale").value = a0;
        document.getElementById("numberslider-value-dynamicestavatarscale").innerText = a0;
    }
    Dynamicest.updateCanvasSize();
};
Dynamicest.settingStoryBottom = function(a0) {
    if (a0) {
        V.Dynamicest.AvatarStoryBottom = a0;
        document.getElementById("numberslider-input-dynamicestavatarstorybottom").value = a0;
        document.getElementById("numberslider-value-dynamicestavatarstorybottom").innerText = a0;
    }
    document.documentElement.style.setProperty('--story-bottom', `${V.Dynamicest.AvatarStoryBottom}px`);
};


`V.Dynamicest.AvatarScale = V.Dynamicest.AvatarScale || 1.2;
    V.Dynamicest.AvatarZ = V.Dynamicest.AvatarZ || 299;
    V.Dynamicest.AvatarX = V.Dynamicest.AvatarX || -100;
    V.Dynamicest.AvatarY = V.Dynamicest.AvatarY || -100;`