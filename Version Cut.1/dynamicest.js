window.Dynamicest = {}

// === 数值存储 =================================
Dynamicest.LastState = new Map();


// === 注入 =====================================
$(document).on(":passagerender", function (ev) {Dynamicest.onPassageRender(ev)});
Dynamicest.onPassageRender = function (ev) {

    // === 数值存储存档 ==============================
    V.Dynamicest = V.Dynamicest || {};

    // 不允许首页出现，因为会导致首次判断出错
    if (V.passage === "Start") return;
    queueMicrotask(() => {
        Dynamicest.LoadStats();
    });
};

Dynamicest.loadRemote = function() {
    queueMicrotask(() => { 
        document.querySelectorAll('[data-remote]').forEach(async element => {
            try {
            const response = await fetch(element.dataset.remote, {
                mode: 'cors',
                credentials: 'omit'
            });
            const data = await response.json();
            if (!data.error) {
                let content = data.value;
                if (element.dataset.replace === 'true') {
                content = content.replaceAll('\n', '<br>');
                }
                element.innerHTML = content;
            }
            } catch (error) {
            element.innerHTML = element.dataset.error || '加载失败';
            }
        });
    });
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
