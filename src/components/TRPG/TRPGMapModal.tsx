import React, { useState } from 'react';
import {
  X,
  Compass,
  MapPin,
  Eye,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Footprints,
  Info,
  Layers,
  ChevronRight,
  Shield,
  Sparkles,
  Mountain,
  Trees,
  Skull,
  Home,
  Store,
} from 'lucide-react';
import {
  TRPGMapState,
  TRPGLocationNode,
  LocationDanger,
  LocationStatus,
  LocationCategory,
} from '../../types/trpg';

interface TRPGMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapState: TRPGMapState;
  onMoveToLocation: (targetNode: TRPGLocationNode) => void;
}

export const TRPGMapModal: React.FC<TRPGMapModalProps> = ({
  isOpen,
  onClose,
  mapState,
  onMoveToLocation,
}) => {
  const locations = mapState?.locations || [];
  const currentLocation = locations.find((l) => l.id === mapState?.currentLocationId) || locations[0];

  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    currentLocation?.id || ''
  );
  const [confirmTravelNode, setConfirmTravelNode] = useState<TRPGLocationNode | null>(null);

  if (!isOpen) return null;

  const selectedLocation =
    locations.find((l) => l.id === selectedLocationId) || currentLocation;

  // Determine if selected location can be moved to from current location
  const isCurrent = selectedLocation?.id === currentLocation?.id;
  const isDirectlyConnected =
    currentLocation &&
    selectedLocation &&
    (currentLocation.connectedNodeIds || []).includes(selectedLocation.id);

  const isLocked =
    selectedLocation?.status === 'unexplored' && !!selectedLocation.unlockRequirement;

  const canTravel = !isCurrent && isDirectlyConnected && !isLocked;

  const getDangerBadge = (danger: LocationDanger) => {
    switch (danger) {
      case 'safe':
        return {
          text: '安全庇护所',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
        };
      case 'low':
        return {
          text: '低危区域',
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          dot: 'bg-sky-500',
        };
      case 'moderate':
        return {
          text: '中度警戒',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
        };
      case 'high':
        return {
          text: '高度危险',
          bg: 'bg-orange-50 text-orange-700 border-orange-200',
          dot: 'bg-orange-500',
        };
      case 'deadly':
        return {
          text: '致命绝境',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          dot: 'bg-rose-500',
        };
    }
  };

  const getCategoryIcon = (category?: LocationCategory) => {
    switch (category) {
      case 'tavern':
        return <Home className="w-3.5 h-3.5 text-amber-600" />;
      case 'town':
        return <Store className="w-3.5 h-3.5 text-sky-600" />;
      case 'wilderness':
        return <Trees className="w-3.5 h-3.5 text-emerald-600" />;
      case 'landmark':
        return <Mountain className="w-3.5 h-3.5 text-indigo-600" />;
      case 'dungeon':
      case 'ruins':
        return <Skull className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <MapPin className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  const getCategoryLabel = (category?: LocationCategory) => {
    switch (category) {
      case 'tavern':
        return '酒馆旅舍';
      case 'town':
        return '城镇集市';
      case 'wilderness':
        return '荒野密林';
      case 'landmark':
        return '风化遗迹/地标';
      case 'dungeon':
        return '危险地城';
      case 'ruins':
        return '古代废墟';
      default:
        return '探险地点';
    }
  };

  const handleStartTravel = (node: TRPGLocationNode) => {
    setConfirmTravelNode(node);
  };

  const handleExecuteTravel = () => {
    if (confirmTravelNode) {
      onMoveToLocation(confirmTravelNode);
      setSelectedLocationId(confirmTravelNode.id);
      setConfirmTravelNode(null);
    }
  };

  // Connected road lines computation
  const roadPairs: Array<{
    id: string;
    from: TRPGLocationNode;
    to: TRPGLocationNode;
    isCurrentPath: boolean;
    isExploredPath: boolean;
  }> = [];

  const handledPairs = new Set<string>();

  locations.forEach((node) => {
    (node.connectedNodeIds || []).forEach((targetId) => {
      const target = locations.find((l) => l.id === targetId);
      if (target) {
        const pairKey = [node.id, target.id].sort().join('--');
        if (!handledPairs.has(pairKey)) {
          handledPairs.add(pairKey);
          const isCurrentPath =
            (node.id === currentLocation?.id && target.id === selectedLocation?.id) ||
            (target.id === currentLocation?.id && node.id === selectedLocation?.id);

          const isExploredPath =
            node.status !== 'unexplored' && target.status !== 'unexplored';

          roadPairs.push({
            id: pairKey,
            from: node,
            to: target,
            isCurrentPath,
            isExploredPath,
          });
        }
      }
    });
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] text-slate-100">
        {/* Header */}
        <div className="p-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-100">探险区域地图</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-amber-300 font-mono">
                  战役版图
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                当前位置：
                <span className="font-semibold text-slate-200">
                  {currentLocation?.name || '未知驻地'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="返回便携终端"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area: Node Graph & Inspection Side Drawer */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-[460px]">
          {/* Interactive Visual Canvas Container */}
          <div className="flex-1 relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 overflow-hidden select-none flex flex-col justify-between">
            {/* Map Top Status & Legend */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800">
              <div className="flex items-center gap-3 text-[11px] text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30 animate-pulse" />
                  当前所在
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  已探明
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  已知路线
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  迷雾笼罩
                </span>
              </div>
              <div className="text-[11px] text-slate-400 hidden sm:block">
                点击节点查看详情并安排行进
              </div>
            </div>

            {/* Interactive Node Graph Area */}
            <div className="relative w-full h-[320px] sm:h-[380px] my-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 overflow-hidden shadow-inner">
              {/* Fantasy Cartography Grid / Contour Lines */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(circle, #f59e0b 1px, transparent 1px), linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)`,
                  backgroundSize: '24px 24px, 48px 48px, 48px 48px',
                }}
              />

              {/* Decorative Compass Rose Watermark */}
              <div className="absolute right-4 bottom-4 pointer-events-none opacity-10">
                <Compass className="w-28 h-28 text-amber-200" />
              </div>

              {/* SVG Connecting Roads */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id="roadGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                {roadPairs.map((road) => {
                  const x1 = `${road.from.coordinates.x}%`;
                  const y1 = `${road.from.coordinates.y}%`;
                  const x2 = `${road.to.coordinates.x}%`;
                  const y2 = `${road.to.coordinates.y}%`;

                  return (
                    <g key={road.id}>
                      {/* Outer shadow/glow line */}
                      {road.isCurrentPath && (
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="#f59e0b"
                          strokeWidth="6"
                          strokeOpacity="0.3"
                          strokeLinecap="round"
                        />
                      )}
                      {/* Main connection line */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={
                          road.isCurrentPath
                            ? '#f59e0b'
                            : road.isExploredPath
                            ? '#64748b'
                            : '#334155'
                        }
                        strokeWidth={road.isCurrentPath ? '2.5' : '1.5'}
                        strokeDasharray={road.isExploredPath ? 'none' : '4 4'}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Map Location Nodes */}
              {locations.map((node) => {
                const isNodeCurrent = node.id === currentLocation?.id;
                const isSelected = node.id === selectedLocation?.id;
                const isNodeLocked =
                  node.status === 'unexplored' && !!node.unlockRequirement;

                const danger = getDangerBadge(node.dangerLevel);

                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedLocationId(node.id)}
                    style={{
                      left: `${node.coordinates.x}%`,
                      top: `${node.coordinates.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute flex flex-col items-center cursor-pointer group transition-all duration-200 z-20 ${
                      isSelected ? 'scale-110 z-30' : 'hover:scale-105'
                    }`}
                  >
                    {/* Pulsing indicator for current position */}
                    {isNodeCurrent && (
                      <span className="absolute -top-3 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] tracking-wider shadow-md animate-bounce flex items-center gap-0.5 whitespace-nowrap">
                        <MapPin className="w-2.5 h-2.5 fill-current" />
                        当前位置
                      </span>
                    )}

                    {/* Node Core Circle */}
                    <div
                      className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg ${
                        isNodeCurrent
                          ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 ring-4 ring-amber-400/40 ring-offset-2 ring-offset-slate-900 font-bold'
                          : isSelected
                          ? 'bg-sky-500 text-white ring-4 ring-sky-400/40 ring-offset-2 ring-offset-slate-900'
                          : node.status === 'explored'
                          ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 hover:border-emerald-400'
                          : node.status === 'known'
                          ? 'bg-slate-800 text-sky-300 border border-sky-500/40 hover:border-sky-400'
                          : 'bg-slate-900 text-slate-500 border border-slate-700/60 opacity-70'
                      }`}
                    >
                      {isNodeLocked ? (
                        <Lock className="w-4 h-4 text-slate-500" />
                      ) : node.status === 'unexplored' ? (
                        <Eye className="w-4 h-4 text-slate-500" />
                      ) : isNodeCurrent ? (
                        <Footprints className="w-5 h-5 text-slate-950 fill-current" />
                      ) : (
                        getCategoryIcon(node.category)
                      )}

                      {/* Small danger indicator dot */}
                      <span
                        className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${danger.dot}`}
                        title={`危险度: ${danger.text}`}
                      />
                    </div>

                    {/* Label below node */}
                    <div
                      className={`mt-1.5 px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors shadow-sm ${
                        isSelected
                          ? 'bg-sky-500 text-white shadow-sky-500/20'
                          : isNodeCurrent
                          ? 'bg-amber-400/90 text-slate-950 font-bold'
                          : 'bg-slate-800/90 text-slate-300 border border-slate-700/70'
                      }`}
                    >
                      {node.status === 'unexplored' && isNodeLocked ? '未知迷雾要塞' : node.name}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Tip */}
            <div className="relative z-10 text-[11px] text-slate-400 flex items-center justify-between">
              <span>探索进度：{locations.filter((l) => l.status === 'explored').length} / {locations.length} 个区域已探明</span>
              <span className="text-slate-500">遵循故事剧情与地理通路行进</span>
            </div>
          </div>

          {/* Right Inspection & Fast Travel Drawer */}
          <div className="w-full lg:w-80 bg-slate-800/90 border-t lg:border-t-0 lg:border-l border-slate-700 p-4 flex flex-col justify-between overflow-y-auto max-h-[260px] lg:max-h-none">
            {selectedLocation ? (
              <div className="space-y-4">
                {/* Header & Badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 font-medium flex items-center gap-1">
                      {getCategoryIcon(selectedLocation.category)}
                      {getCategoryLabel(selectedLocation.category)}
                    </span>
                    {(() => {
                      const d = getDangerBadge(selectedLocation.dangerLevel);
                      return (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${d.bg}`}
                        >
                          {d.text}
                        </span>
                      );
                    })()}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-1.5">
                    {selectedLocation.status === 'unexplored' && isLocked
                      ? '未知迷雾要塞'
                      : selectedLocation.name}
                    {isCurrent && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        当前
                      </span>
                    )}
                  </h3>
                </div>

                {/* Description */}
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/80 text-xs text-slate-300 leading-relaxed font-sans">
                  {selectedLocation.status === 'unexplored' && isLocked
                    ? '此区域处于浓密迷雾与未知魔法屏障之下，唯有循着剧情线索或持有通行凭信方可勘探全貌。'
                    : selectedLocation.description}
                </div>

                {/* Environment Tags */}
                {selectedLocation.environmentTags && selectedLocation.environmentTags.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      环境地貌要素
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLocation.environmentTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md bg-slate-700/70 text-slate-300 text-[11px] border border-slate-600/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unlock Requirement Warning */}
                {selectedLocation.unlockRequirement && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200/90 space-y-1">
                    <div className="flex items-center gap-1 font-bold text-amber-300">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      通行限制条件
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-200/80">
                      {selectedLocation.unlockRequirement}
                    </p>
                  </div>
                )}

                {/* Connected Neighbours */}
                <div className="space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    相连直达通路
                  </span>
                  <div className="space-y-1">
                    {(selectedLocation.connectedNodeIds || []).map((cid) => {
                      const cNode = locations.find((l) => l.id === cid);
                      if (!cNode) return null;
                      const isSelfCurrent = cNode.id === currentLocation?.id;
                      return (
                        <div
                          key={cid}
                          onClick={() => setSelectedLocationId(cNode.id)}
                          className={`p-1.5 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isSelfCurrent
                              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                              : 'bg-slate-700/50 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {getCategoryIcon(cNode.category)}
                            {cNode.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {isSelfCurrent ? '当前驻地' : '可通达'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                请点击地图节点查看详细情报
              </div>
            )}

            {/* Travel Action Controls */}
            <div className="pt-4 border-t border-slate-700 mt-4 space-y-2">
              {isCurrent ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-400 text-xs font-semibold cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  当前已身处此地
                </button>
              ) : canTravel ? (
                <button
                  type="button"
                  onClick={() => handleStartTravel(selectedLocation)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Footprints className="w-4 h-4" />
                  启程行进至【{selectedLocation.name}】
                </button>
              ) : isLocked ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-slate-700/60 text-slate-500 text-xs font-semibold cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-4 h-4 text-slate-500" />
                  前路受阻：未达成准入要求
                </button>
              ) : !isDirectlyConnected ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 rounded-xl bg-slate-700/60 text-slate-500 text-xs font-semibold cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4 text-slate-500" />
                  距离过远（需先前往相邻中转地点）
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Travel Confirmation Modal Overlay */}
        {confirmTravelNode && (
          <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-2.5 text-amber-400 font-bold text-base">
                <Footprints className="w-5 h-5 shrink-0" />
                <span>确认队伍行程</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                你将带领队伍从【{currentLocation?.name}】出发，沿道路前往【
                <span className="font-bold text-amber-300">{confirmTravelNode.name}</span>
                】。
              </p>
              <div className="p-3 rounded-xl bg-slate-800 text-xs text-slate-400 space-y-1">
                <div>危险评级：{getDangerBadge(confirmTravelNode.dangerLevel).text}</div>
                <div>预计耗时：短途徒步（沿途将触发环境与剧情变迁）</div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmTravelNode(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  再作权衡
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTravel}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-md cursor-pointer flex items-center gap-1"
                >
                  <Footprints className="w-3.5 h-3.5" />
                  立即启程
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
