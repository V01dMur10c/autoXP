// copy this script content to create a new macro in FVTT.

// 检查角色的拥有者是否在线
function isActorOwnerOnline(actor) {
    const ownerIds = Object.keys(actor.ownership).filter(userId => 
        userId !== "default" && 
        actor.ownership[userId] >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    );
    
    return ownerIds.some(userId => {
        const user = game.users.get(userId);
        return user && user.active && !user.isGM;
    });
}
function getPlayerOwnedActors() {
    return game.actors.filter(actor => 
        actor.type === "character" && 
        actor.hasPlayerOwner
    );
}

// 创建对话框内容
function createDialogContent(playerActors) {
    let actorOptions = "";
    playerActors.forEach(actor => {
        // 显示角色名和拥有者信息，排除GM
        const owners = Object.keys(actor.ownership)
            .map(userId => {
                const user = game.users.get(userId);
                return user && !user.isGM ? user.name : null;
            })
            .filter(name => name)
            .join(", ");
        const displayName = owners ? `${actor.name} (${owners})` : actor.name;
        actorOptions += `<option value="${actor.id}">${displayName}</option>`;
    });
    
    return `
        <div style="display: flex; flex-direction: column; gap: 15px; padding: 10px;">
            <div>
                <label for="actor-select" style="display: block; margin-bottom: 5px; font-weight: bold;">选择角色:</label>
                <select id="actor-select" style="width: 100%; padding: 5px;">
                    <option value="">-- 请选择角色 --</option>
                    <option value="all_players">🎭 全体玩家角色</option>
                    ${actorOptions}
                </select>
            </div>
            <div>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" id="skip-offline" style="margin: 0;" />
                    <span style="font-weight: bold;">跳过不在线玩家</span>
                </label>
            </div>
            <div>
                <label for="xp-input" style="display: block; margin-bottom: 5px; font-weight: bold;">经验值:</label>
                <input type="number" id="xp-input" min="0" placeholder="输入要增加的经验值" style="width: 100%; padding: 5px;" />
            </div>
        </div>
    `;
}

// 主函数
async function addExperiencePoints() {
    const playerActors = getPlayerOwnedActors();
    
    if (playerActors.length === 0) {
        ui.notifications.error("没有找到被玩家拥有的角色");
        return;
    }
    
    const content = createDialogContent(playerActors);
    
    new Dialog({
        title: "增加经验值",
        content: content,
        buttons: {
            add: {
                label: "增加经验",
                callback: async (html) => {
                    const selectedActorId = html.find("#actor-select").val();
                    const xpToAdd = parseInt(html.find("#xp-input").val());
                    const skipOffline = html.find("#skip-offline").prop("checked");
                    
                    // 验证输入
                    if (!selectedActorId) {
                        ui.notifications.warn("请选择一个角色");
                        return;
                    }
                    
                    if (!xpToAdd || xpToAdd <= 0) {
                        ui.notifications.warn("请输入有效的经验值");
                        return;
                    }
                    
                    try {
                        if (selectedActorId === "all_players") {
                            // 为所有玩家角色增加经验
                            let processedCount = 0;
                            let skippedCount = 0;
                            
                            for (const actor of playerActors) {
                                // 检查是否跳过离线玩家
                                if (skipOffline && !isActorOwnerOnline(actor)) {
                                    skippedCount++;
                                    continue;
                                }
                                
                                const currentXP = actor.system.details.xp.value || 0;
                                const newXP = currentXP + xpToAdd;
                                
                                await actor.update({
                                    "system.details.xp.value": newXP
                                });
                                
                                processedCount++;
                            }
                            
                            let message = `成功为 ${processedCount} 个角色增加了 ${xpToAdd} 点经验值！`;
                            if (skippedCount > 0) {
                                message += ` (跳过了 ${skippedCount} 个离线玩家的角色)`;
                            }
                            ui.notifications.info(message);
                            
                        } else {
                            // 为单个角色增加经验
                            const selectedActor = game.actors.get(selectedActorId);
                            if (!selectedActor) {
                                ui.notifications.error("找不到选中的角色");
                                return;
                            }
                            
                            // 检查是否跳过离线玩家
                            if (skipOffline && !isActorOwnerOnline(selectedActor)) {
                                ui.notifications.warn(`${selectedActor.name} 的拥有者不在线，已跳过`);
                                return;
                            }
                            
                            // 获取当前经验值
                            const currentXP = selectedActor.system.details.xp.value || 0;
                            const newXP = currentXP + xpToAdd;
                            
                            // 更新角色经验值
                            await selectedActor.update({
                                "system.details.xp.value": newXP
                            });
                            
                            ui.notifications.info(`成功为 ${selectedActor.name} 增加了 ${xpToAdd} 点经验值！当前经验值: ${newXP}`);
                        }
                        
                    } catch (error) {
                        console.error("更新经验值时出错:", error);
                        ui.notifications.error("更新经验值时出现错误，请检查控制台");
                    }
                }
            },
            cancel: {
                label: "取消",
                callback: () => {}
            }
        },
        default: "add",
        render: (html) => {
            // 为输入框添加回车键监听
            html.find("#xp-input").keypress(function(e) {
                if (e.which === 13) { // 回车键
                    html.find("button:contains('增加经验')").click();
                }
            });
        }
    }).render(true);
}

// 执行宏
addExperiencePoints();
