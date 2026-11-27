import { DriverTier, DifficultyLevel, RoomStatus } from '@/lib/types';
import { LanguageCode } from './types';

export const TIER_TRANSLATIONS: Record<LanguageCode, Record<DriverTier, string>> = {
  pt: {
    Aprendiz: 'Aprendiz',
    Condutor: 'Condutor',
    Especialista: 'Especialista',
    'Mestre da Estrada': 'Mestre da Estrada',
  },
  en: {
    Aprendiz: 'Apprentice',
    Condutor: 'Driver',
    Especialista: 'Specialist',
    'Mestre da Estrada': 'Road Master',
  },
  es: {
    Aprendiz: 'Aprendiz',
    Condutor: 'Conductor',
    Especialista: 'Especialista',
    'Mestre da Estrada': 'Maestro de la Vía',
  },
  fr: {
    Aprendiz: 'Apprenti',
    Condutor: 'Conducteur',
    Especialista: 'Spécialiste',
    'Mestre da Estrada': 'Maître de la Route',
  },
  ru: {
    Aprendiz: 'Ученик',
    Condutor: 'Водитель',
    Especialista: 'Специалист',
    'Mestre da Estrada': 'Мастер дорог',
  },
  zh: {
    Aprendiz: '学员',
    Condutor: '驾驶员',
    Especialista: '专家',
    'Mestre da Estrada': '公路大师',
  },
  ja: {
    Aprendiz: '見習い',
    Condutor: 'ドライバー',
    Especialista: 'エキスパート',
    'Mestre da Estrada': 'ロードマスター',
  },
  ar: {
    Aprendiz: 'متدرب',
    Condutor: 'سائق',
    Especialista: 'متخصص',
    'Mestre da Estrada': 'خبير الطريق',
  },
};

export const DIFFICULTY_TRANSLATIONS: Record<
  LanguageCode,
  Record<DifficultyLevel, string>
> = {
  pt: {
    Iniciante: 'Iniciante',
    Intermédio: 'Intermédio',
    Avançado: 'Avançado',
    'Exame Oficial': 'Exame Oficial',
  },
  en: {
    Iniciante: 'Beginner',
    Intermédio: 'Intermediate',
    Avançado: 'Advanced',
    'Exame Oficial': 'Official Exam',
  },
  es: {
    Iniciante: 'Principiante',
    Intermédio: 'Intermedio',
    Avançado: 'Avanzado',
    'Exame Oficial': 'Examen Oficial',
  },
  fr: {
    Iniciante: 'Débutant',
    Intermédio: 'Intermédiaire',
    Avançado: 'Avancé',
    'Exame Oficial': 'Examen Officiel',
  },
  ru: {
    Iniciante: 'Начальный',
    Intermédio: 'Средний',
    Avançado: 'Продвинутый',
    'Exame Oficial': 'Официальный экзамен',
  },
  zh: {
    Iniciante: '初级',
    Intermédio: '中级',
    Avançado: '高级',
    'Exame Oficial': '正式考试',
  },
  ja: {
    Iniciante: '初級',
    Intermédio: '中級',
    Avançado: '上級',
    'Exame Oficial': '公式試験',
  },
  ar: {
    Iniciante: 'مبتدئ',
    Intermédio: 'متوسط',
    Avançado: 'متقدم',
    'Exame Oficial': 'الامتحان الرسمي',
  },
};

export const CATEGORY_TRANSLATIONS: Record<
  LanguageCode,
  Record<string, string>
> = {
  pt: {
    Geral: 'Geral',
    'Sinais de Trânsito': 'Sinais de Trânsito',
    'Regras de Prioridade': 'Regras de Prioridade',
    'Limites de Velocidade': 'Limites de Velocidade',
    'Condução Defensiva': 'Condução Defensiva',
    'Rotundas e Cruzamentos': 'Rotundas e Cruzamentos',
    'Documentação Obrigatória': 'Documentação Obrigatória',
    'Primeiros Socorros': 'Primeiros Socorros',
    'Mecânica Básica': 'Mecânica Básica',
  },
  en: {
    Geral: 'General',
    'Sinais de Trânsito': 'Traffic Signs',
    'Regras de Prioridade': 'Right-of-Way Rules',
    'Limites de Velocidade': 'Speed Limits',
    'Condução Defensiva': 'Defensive Driving',
    'Rotundas e Cruzamentos': 'Roundabouts & Intersections',
    'Documentação Obrigatória': 'Mandatory Documents',
    'Primeiros Socorros': 'First Aid',
    'Mecânica Básica': 'Basic Mechanics',
  },
  es: {
    Geral: 'General',
    'Sinais de Trânsito': 'Señales de Tráfico',
    'Regras de Prioridade': 'Reglas de Prioridad',
    'Limites de Velocidade': 'Límites de Velocidad',
    'Condução Defensiva': 'Conducción Defensiva',
    'Rotundas e Cruzamentos': 'Rotondas y Cruces',
    'Documentação Obrigatória': 'Documentación Obligatoria',
    'Primeiros Socorros': 'Primeros Auxilios',
    'Mecânica Básica': 'Mecánica Básica',
  },
  fr: {
    Geral: 'Général',
    'Sinais de Trânsito': 'Panneaux de Signalisation',
    'Regras de Prioridade': 'Règles de Priorité',
    'Limites de Velocidade': 'Limitations de Vitesse',
    'Condução Defensiva': 'Conduite Préventive',
    'Rotundas e Cruzamentos': 'Ronds-points & Carrefours',
    'Documentação Obrigatória': 'Documents Obligatoires',
    'Primeiros Socorros': 'Premiers Secours',
    'Mecânica Básica': 'Mécanique de Base',
  },
  ru: {
    Geral: 'Общее',
    'Sinais de Trânsito': 'Дорожные знаки',
    'Regras de Prioridade': 'Правила приоритета',
    'Limites de Velocidade': 'Ограничения скорости',
    'Condução Defensiva': 'Защитное вождение',
    'Rotundas e Cruzamentos': 'Кольца и перекрёстки',
    'Documentação Obrigatória': 'Обязательные документы',
    'Primeiros Socorros': 'Первая помощь',
    'Mecânica Básica': 'Основы механики',
  },
  zh: {
    Geral: '综合',
    'Sinais de Trânsito': '交通标志',
    'Regras de Prioridade': '优先通行规则',
    'Limites de Velocidade': '速度限制',
    'Condução Defensiva': '防御性驾驶',
    'Rotundas e Cruzamentos': '环岛与路口',
    'Documentação Obrigatória': '必备证件',
    'Primeiros Socorros': '急救知识',
    'Mecânica Básica': '基础机械',
  },
  ja: {
    Geral: '総合',
    'Sinais de Trânsito': '道路標識',
    'Regras de Prioridade': '優先通行ルール',
    'Limites de Velocidade': '制限速度',
    'Condução Defensiva': '防衛運転',
    'Rotundas e Cruzamentos': '環状交差点・交差点',
    'Documentação Obrigatória': '必携書類',
    'Primeiros Socorros': '応急処置',
    'Mecânica Básica': '基本整備',
  },
  ar: {
    Geral: 'عام',
    'Sinais de Trânsito': 'إشارات المرور',
    'Regras de Prioridade': 'قواعد الأولوية',
    'Limites de Velocidade': 'حدود السرعة',
    'Condução Defensiva': 'القيادة الوقائية',
    'Rotundas e Cruzamentos': 'الدوارات والتقاطعات',
    'Documentação Obrigatória': 'الوثائق الإلزامية',
    'Primeiros Socorros': 'الإسعافات الأولية',
    'Mecânica Básica': 'ميكانيكا أساسية',
  },
};

export const SIGN_LABELS_I18N: Record<LanguageCode, Record<string, string>> = {
  pt: {
    lombas: 'Lombas na via',
    passagem_peoes: 'Passagem de peões',
    stop: 'Paragem obrigatória (STOP)',
    cedencia_passagem: 'Cedência de passagem',
    proibido_ultrapassar: 'Proibido ultrapassar',
    velocidade_60: 'Velocidade máxima 60 km/h',
    velocidade_50: 'Velocidade máxima 50 km/h',
    velocidade_80: 'Velocidade máxima 80 km/h',
    curva_perigosa: 'Curva perigosa à direita',
    sentido_proibido: 'Sentido proibido',
    rotunda: 'Rotunda / Circulação giratória',
    cruzamento: 'Cruzamento ou entroncamento',
    estacionamento_proibido: 'Estacionamento proibido',
    piso_escorregadio: 'Pavimento escorregadio',
    trabalhos_via: 'Trabalhos na via',
    semaforos: 'Aproximação de semáforos',
  },
  en: {
    lombas: 'Speed bumps ahead',
    passagem_peoes: 'Pedestrian crossing',
    stop: 'Mandatory stop (STOP)',
    cedencia_passagem: 'Give way / Yield',
    proibido_ultrapassar: 'No overtaking',
    velocidade_60: 'Maximum speed 60 km/h',
    velocidade_50: 'Maximum speed 50 km/h',
    velocidade_80: 'Maximum speed 80 km/h',
    curva_perigosa: 'Dangerous bend right',
    sentido_proibido: 'No entry',
    rotunda: 'Roundabout',
    cruzamento: 'Crossroads / Junction',
    estacionamento_proibido: 'No parking',
    piso_escorregadio: 'Slippery road',
    trabalhos_via: 'Road works',
    semaforos: 'Traffic lights ahead',
  },
  es: {
    lombas: 'Resaltos en la vía',
    passagem_peoes: 'Paso de peatones',
    stop: 'Detención obligatoria (STOP)',
    cedencia_passagem: 'Ceda el paso',
    proibido_ultrapassar: 'Prohibido adelantar',
    velocidade_60: 'Velocidad máxima 60 km/h',
    velocidade_50: 'Velocidad máxima 50 km/h',
    velocidade_80: 'Velocidad máxima 80 km/h',
    curva_perigosa: 'Curva peligrosa a la derecha',
    sentido_proibido: 'Dirección prohibida',
    rotunda: 'Rotonda / Glorieta',
    cruzamento: 'Cruce o intersección',
    estacionamento_proibido: 'Prohibido estacionar',
    piso_escorregadio: 'Pavimento deslizante',
    trabalhos_via: 'Obras en la vía',
    semaforos: 'Aproximación a semáforos',
  },
  fr: {
    lombas: 'Ralentisseurs / Dos-d’âne',
    passagem_peoes: 'Passage piétons',
    stop: 'Arrêt obligatoire (STOP)',
    cedencia_passagem: 'Cédez le passage',
    proibido_ultrapassar: 'Dépassement interdit',
    velocidade_60: 'Vitesse maximale 60 km/h',
    velocidade_50: 'Vitesse maximale 50 km/h',
    velocidade_80: 'Vitesse maximale 80 km/h',
    curva_perigosa: 'Virage dangereux à droite',
    sentido_proibido: 'Sens interdit',
    rotunda: 'Rond-point / Sens giratoire',
    cruzamento: 'Carrefour / Intersection',
    estacionamento_proibido: 'Stationnement interdit',
    piso_escorregadio: 'Chaussée glissante',
    trabalhos_via: 'Travaux sur la chaussée',
    semaforos: 'Feux tricolores à venir',
  },
  ru: {
    lombas: 'Искусственная неровность',
    passagem_peoes: 'Пешеходный переход',
    stop: 'Движение без остановки запрещено (STOP)',
    cedencia_passagem: 'Уступите дорогу',
    proibido_ultrapassar: 'Обгон запрещён',
    velocidade_60: 'Ограничение скорости 60 км/ч',
    velocidade_50: 'Ограничение скорости 50 км/ч',
    velocidade_80: 'Ограничение скорости 80 км/ч',
    curva_perigosa: 'Опасный поворот направо',
    sentido_proibido: 'Въезд запрещён',
    rotunda: 'Круговое движение',
    cruzamento: 'Перекрёсток',
    estacionamento_proibido: 'Стоянка запрещена',
    piso_escorregadio: 'Скользкая дорога',
    trabalhos_via: 'Дорожные работы',
    semaforos: 'Светофорное регулирование',
  },
  zh: {
    lombas: '前方减速带',
    passagem_peoes: '人行横道',
    stop: '停车让行 (STOP)',
    cedencia_passagem: '减速让行',
    proibido_ultrapassar: '禁止超车',
    velocidade_60: '最高限速 60 km/h',
    velocidade_50: '最高限速 50 km/h',
    velocidade_80: '最高限速 80 km/h',
    curva_perigosa: '向右急弯路',
    sentido_proibido: '禁止驶入',
    rotunda: '环岛行驶',
    cruzamento: '交叉路口',
    estacionamento_proibido: '禁止停车',
    piso_escorregadio: '易滑路面',
    trabalhos_via: '前方施工',
    semaforos: '注意信号灯',
  },
  ja: {
    lombas: '路面凹凸・ハンプあり',
    passagem_peoes: '横断歩道',
    stop: '一時停止 (STOP)',
    cedencia_passagem: '前方優先・譲れ',
    proibido_ultrapassar: '追越し禁止',
    velocidade_60: '最高速度 60 km/h',
    velocidade_50: '最高速度 50 km/h',
    velocidade_80: '最高速度 80 km/h',
    curva_perigosa: '右急カーブ',
    sentido_proibido: '進入禁止',
    rotunda: '環状交差点（ロータリー）',
    cruzamento: '交差点注意',
    estacionamento_proibido: '駐車禁止',
    piso_escorregadio: 'スリップ注意',
    trabalhos_via: '道路工事中',
    semaforos: '信号機あり',
  },
  ar: {
    lombas: 'مطبّات على الطريق',
    passagem_peoes: 'معبر مشاة',
    stop: 'توقّف إجباري (STOP)',
    cedencia_passagem: 'أفسح الطريق',
    proibido_ultrapassar: 'ممنوع التجاوز',
    velocidade_60: 'السرعة القصوى 60 كم/س',
    velocidade_50: 'السرعة القصوى 50 كم/س',
    velocidade_80: 'السرعة القصوى 80 كم/س',
    curva_perigosa: 'منعطف خطير لليمين',
    sentido_proibido: 'ممنوع الدخول',
    rotunda: 'دوار / حركة دائرية',
    cruzamento: 'تقاطع طرق',
    estacionamento_proibido: 'ممنوع الوقوف',
    piso_escorregadio: 'طريق زلق',
    trabalhos_via: 'أشغال على الطريق',
    semaforos: 'إشارات ضوئية أمامك',
  },
};

export const ACHIEVEMENT_I18N: Record<
  LanguageCode,
  Record<string, { title: string; description: string }>
> = {
  pt: {
    primeira_corrida: {
      title: 'Primeira Partida',
      description: 'Completou a sua primeira competição ao vivo.',
    },
    vitoria_inaugural: {
      title: 'Campeão da Pista',
      description: 'Alcançou o 1.º lugar numa competição oficial.',
    },
    precisao_80: {
      title: 'Volante Certeiro',
      description: 'Obteve pelo menos 80% de acerto numa competição.',
    },
    cem_pontos: {
      title: 'Centurião da Estrada',
      description: 'Acumulou 100 ou mais pontos totais no ranking geral.',
    },
    cinco_vitorias: {
      title: 'Instrutor Honorário',
      description: 'Venceu 5 competições ao vivo.',
    },
    sequencia_5: {
      title: 'Sem Travões',
      description: 'Manteve uma sequência de 5 ou mais jogos com pontuação.',
    },
  },
  en: {
    primeira_corrida: {
      title: 'First Race',
      description: 'Completed your first live competition.',
    },
    vitoria_inaugural: {
      title: 'Track Champion',
      description: 'Achieved 1st place in an official competition.',
    },
    precisao_80: {
      title: 'Sharp Steering',
      description: 'Scored at least 80% accuracy in a competition.',
    },
    cem_pontos: {
      title: 'Road Centurion',
      description: 'Accumulated 100 or more total points in the overall ranking.',
    },
    cinco_vitorias: {
      title: 'Honorary Instructor',
      description: 'Won 5 live competitions.',
    },
    sequencia_5: {
      title: 'No Brakes',
      description: 'Kept a streak of 5 or more scoring games.',
    },
  },
  es: {
    primeira_corrida: {
      title: 'Primera Partida',
      description: 'Completó su primera competición en vivo.',
    },
    vitoria_inaugural: {
      title: 'Campeón de la Pista',
      description: 'Alcanzó el 1.º puesto en una competición oficial.',
    },
    precisao_80: {
      title: 'Volante Certero',
      description: 'Obtuvo al menos 80% de acierto en una competición.',
    },
    cem_pontos: {
      title: 'Centurión de la Vía',
      description: 'Acumuló 100 o más puntos totales en el ranking general.',
    },
    cinco_vitorias: {
      title: 'Instructor Honorario',
      description: 'Ganó 5 competiciones en vivo.',
    },
    sequencia_5: {
      title: 'Sin Frenos',
      description: 'Mantuvo una racha de 5 o más partidas puntuando.',
    },
  },
  fr: {
    primeira_corrida: {
      title: 'Premier Départ',
      description: 'A terminé sa première compétition en direct.',
    },
    vitoria_inaugural: {
      title: 'Champion de la Piste',
      description: 'A obtenu la 1re place dans une compétition officielle.',
    },
    precisao_80: {
      title: 'Volant Précis',
      description: 'A atteint au moins 80 % de réussite dans une compétition.',
    },
    cem_pontos: {
      title: 'Centurion de la Route',
      description: 'A cumulé 100 points ou plus au classement général.',
    },
    cinco_vitorias: {
      title: 'Moniteur Honoraire',
      description: 'A remporté 5 compétitions en direct.',
    },
    sequencia_5: {
      title: 'Sans Freins',
      description: 'A maintenu une série de 5 parties ou plus avec points.',
    },
  },
  ru: {
    primeira_corrida: {
      title: 'Первый старт',
      description: 'Завершил своё первое живое соревнование.',
    },
    vitoria_inaugural: {
      title: 'Чемпион трассы',
      description: 'Занял 1-е место в официальном соревновании.',
    },
    precisao_80: {
      title: 'Точный руль',
      description: 'Набрал не менее 80% точности в соревновании.',
    },
    cem_pontos: {
      title: 'Центурион дорог',
      description: 'Накопил 100 или более очков в общем рейтинге.',
    },
    cinco_vitorias: {
      title: 'Почётный инструктор',
      description: 'Выиграл 5 живых соревнований.',
    },
    sequencia_5: {
      title: 'Без тормозов',
      description: 'Провёл серию из 5 и более результативных игр.',
    },
  },
  zh: {
    primeira_corrida: {
      title: '首次出赛',
      description: '完成了首次实时驾驶竞赛。',
    },
    vitoria_inaugural: {
      title: '赛道冠军',
      description: '在官方竞赛中获得第 1 名。',
    },
    precisao_80: {
      title: '精准掌舵',
      description: '在一场竞赛中达到至少 80% 的准确率。',
    },
    cem_pontos: {
      title: '百夫长车手',
      description: '在总排行榜累计获得 100 分或以上。',
    },
    cinco_vitorias: {
      title: '荣誉教练',
      description: '赢得 5 场实时竞赛。',
    },
    sequencia_5: {
      title: '全速前进',
      description: '保持连续 5 场及以上得分记录。',
    },
  },
  ja: {
    primeira_corrida: {
      title: '初レース',
      description: '初めてのライブ競技を完了しました。',
    },
    vitoria_inaugural: {
      title: 'トラック王者',
      description: '公式競技で1位を獲得しました。',
    },
    precisao_80: {
      title: '正確なハンドル',
      description: '競技で正答率80%以上を達成しました。',
    },
    cem_pontos: {
      title: 'ロード・センチュリオン',
      description: '総合ランキングで累計100ポイント以上を獲得しました。',
    },
    cinco_vitorias: {
      title: '名誉インストラクター',
      description: 'ライブ競技で5勝を達成しました。',
    },
    sequencia_5: {
      title: 'ノーブレーキ',
      description: '5試合以上連続でスコアを獲得しました。',
    },
  },
  ar: {
    primeira_corrida: {
      title: 'السباق الأول',
      description: 'أكمل أول مسابقة مباشرة له.',
    },
    vitoria_inaugural: {
      title: 'بطل المضمار',
      description: 'حقق المركز الأول في مسابقة رسمية.',
    },
    precisao_80: {
      title: 'مقود دقيق',
      description: 'حقق نسبة دقة لا تقل عن 80% في إحدى المسابقات.',
    },
    cem_pontos: {
      title: 'قائد المئة',
      description: 'جمع 100 نقطة أو أكثر في الترتيب العام.',
    },
    cinco_vitorias: {
      title: 'مدرب فخري',
      description: 'فاز في 5 مسابقات مباشرة.',
    },
    sequencia_5: {
      title: 'بلا فرامل',
      description: 'حافظ على سلسلة من 5 مباريات متتالية بنقاط.',
    },
  },
};

export const CORE_RULES_I18N: Record<
  LanguageCode,
  Array<{ title: string; body: string }>
> = {
  pt: [
    {
      title: 'Prioridade à Direita',
      body: 'Nos cruzamentos e entroncamentos não sinalizados, o condutor deve ceder a passagem aos veículos que se apresentem pela sua direita, salvo veículos prioritários em marcha de urgência.',
    },
    {
      title: 'Circulação em Rotundas',
      body: 'Ao entrar numa rotunda, deve ceder-se a passagem aos veículos que já circulam no interior da mesma. Sinalize sempre a mudança de direção antes de sair.',
    },
    {
      title: 'Limites de Velocidade Gerais',
      body: 'Dentro das localidades em Angola, respeite a sinalização local e a velocidade máxima urbana aplicável a automóveis ligeiros (habitualmente 60 km/h salvo indicação inferior). Reduza sempre próximo de escolas e passadeiras.',
    },
    {
      title: 'Documentação Obrigatória',
      body: 'O condutor deve fazer-se acompanhar da Carta de Condução válida, Bilhete de Identidade, Livrete / Título de Registo de Propriedade do veículo e Seguro Automóvel Obrigatório.',
    },
  ],
  en: [
    {
      title: 'Priority to the Right',
      body: 'At unsigned intersections and junctions, drivers must yield to vehicles approaching from their right, except emergency priority vehicles.',
    },
    {
      title: 'Roundabout Circulation',
      body: 'When entering a roundabout, yield to vehicles already circulating inside it. Always signal your exit before leaving the roundabout.',
    },
    {
      title: 'General Speed Limits',
      body: 'Inside built-up areas in Angola, obey local signage and the standard urban speed limit for light vehicles (typically 60 km/h unless lower is posted). Always slow down near schools and crosswalks.',
    },
    {
      title: 'Mandatory Documents',
      body: 'Drivers must carry a valid Driving License, ID card, Vehicle Registration Title (Livrete), and Mandatory Auto Insurance.',
    },
  ],
  es: [
    {
      title: 'Prioridad a la Derecha',
      body: 'En cruces e intersecciones sin señalizar, el conductor debe ceder el paso a los vehículos que se aproximen por su derecha, salvo vehículos prioritarios en servicio urgente.',
    },
    {
      title: 'Circulación en Rotondas',
      body: 'Al entrar en una rotonda, se debe ceder el paso a los vehículos que ya circulan por su interior. Señaliza siempre el cambio de dirección antes de salir.',
    },
    {
      title: 'Límites Generales de Velocidad',
      body: 'Dentro de las localidades en Angola, respeta la señalización local y el límite urbano para automóviles ligeros (habitualmente 60 km/h salvo señal menor). Reduce cerca de escuelas y pasos de peatones.',
    },
    {
      title: 'Documentación Obligatoria',
      body: 'El conductor debe portar el Permiso de Conducir vigente, documento de identidad, título de propiedad del vehículo y seguro obligatorio.',
    },
  ],
  fr: [
    {
      title: 'Priorité à Droite',
      body: 'Aux carrefours non signalés, le conducteur doit céder le passage aux véhicules venant de sa droite, sauf véhicules prioritaires en urgence.',
    },
    {
      title: 'Circulation dans les Ronds-Points',
      body: 'À l’entrée d’un rond-point, cédez le passage aux véhicules déjà engagés à l’intérieur. Indiquez toujours votre sortie avec le clignotant.',
    },
    {
      title: 'Limitations de Vitesse Générales',
      body: 'En agglomération en Angola, respectez la signalisation locale et la vitesse urbaine applicable aux véhicules légers (généralement 60 km/h sauf mention contraire). Ralentissez près des écoles et passages piétons.',
    },
    {
      title: 'Documents Obligatoires',
      body: 'Le conducteur doit avoir sur lui un permis de conduire valide, sa pièce d’identité, le certificat d’immatriculation du véhicule et l’assurance obligatoire.',
    },
  ],
  ru: [
    {
      title: 'Помеха справа',
      body: 'На нерегулируемых перекрёстках водитель обязан уступить дорогу транспортным средствам, приближающимся справа, за исключением спецтранспорта с включёнными сигналами.',
    },
    {
      title: 'Движение по кольцу',
      body: 'При въезде на круговое движение необходимо уступить дорогу автомобилям, уже движущимся по кольцу. Перед выездом обязательно включите указатель поворота.',
    },
    {
      title: 'Общие ограничения скорости',
      body: 'В населённых пунктах Анголы соблюдайте дорожные знаки и городское ограничение для легковых авто (обычно 60 км/ч, если не указано меньше). Снижайте скорость у школ и переходов.',
    },
    {
      title: 'Обязательные документы',
      body: 'Водитель обязан иметь при себе действительное водительское удостоверение, удостоверение личности, регистрационные документы на автомобиль и обязательную страховку.',
    },
  ],
  zh: [
    {
      title: '右侧优先原则',
      body: '在无标志的交叉路口，驾驶员必须让右侧驶来的车辆先行，执行紧急任务的优先车辆除外。',
    },
    {
      title: '环岛行驶规则',
      body: '进入环岛时须礼让已在环岛内行驶的车辆；驶出环岛前务必提前开启转向灯。',
    },
    {
      title: '通用限速规定',
      body: '在安哥拉城镇路段，请遵守当地标志及小型汽车城市限速（通常为 60 km/h，另有低限速标志除外）。经过学校和人行横道时请减速。',
    },
    {
      title: '必备证件',
      body: '驾驶员须随身携带有效驾驶证、身份证件、车辆登记证以及强制汽车保险。',
    },
  ],
  ja: [
    {
      title: '右側優先の原則',
      body: '標識のない交差点では、緊急走行中の優先車両を除き、右側から接近する車両に進路を譲る必要があります。',
    },
    {
      title: '環状交差点（ロータリー）の通行',
      body: 'ロータリーに進入する際は、すでに内部を走行している車両を優先し、退出前には必ず合図を出してください。',
    },
    {
      title: '一般制限速度',
      body: 'アンゴラの市街地では現地の標識と普通車の都市制限速度（通常60 km/h、より低い指定がある場合を除く）を守り、学校や横断歩道付近では減速してください。',
    },
    {
      title: '必携書類',
      body: '有効な運転免許証、身分証明書、車両登録証、および自賠責保険証券を常に携帯する必要があります。',
    },
  ],
  ar: [
    {
      title: 'الأولوية لليمين',
      body: 'عند التقاطعات غير المزودة بإشارات، يجب على السائق إفساح المجال للمركبات القادمة من جهة اليمين، باستثناء مركبات الطوارئ ذات الأولوية.',
    },
    {
      title: 'السير في الدوارات',
      body: 'عند دخول الدوار، يجب إعطاء الأولوية للمركبات التي تسير داخله بالفعل، واستخدام إشارة تغيير الاتجاه دائماً قبل الخروج.',
    },
    {
      title: 'حدود السرعة العامة',
      body: 'داخل المناطق الحضرية في أنغولا، التزم باللافتات المحلية والحد الأقصى للسرعة للمركبات الخفيفة (غالباً 60 كم/س ما لم يُذكر أقل). خفف السرعة قرب المدارس ومعابر المشاة.',
    },
    {
      title: 'الوثائق الإلزامية',
      body: 'يجب أن يحمل السائق رخصة قيادة سارية المفعول، بطاقة الهوية، دفتر ملكية المركبة، والتأمين الإلزامي للسيارة.',
    },
  ],
};

export const ROOM_STATUS_TRANSLATIONS: Record<
  LanguageCode,
  Record<RoomStatus, string>
> = {
  pt: {
    WAITING: 'Em espera',
    STARTING: 'A iniciar',
    PLAYING: 'Em direto',
    ANSWER_REVEAL: 'Revelação',
    LEADERBOARD: 'Classificação',
    FINISHED: 'Encerrada',
  },
  en: {
    WAITING: 'Waiting',
    STARTING: 'Starting',
    PLAYING: 'Live',
    ANSWER_REVEAL: 'Reveal',
    LEADERBOARD: 'Leaderboard',
    FINISHED: 'Finished',
  },
  es: {
    WAITING: 'En espera',
    STARTING: 'Iniciando',
    PLAYING: 'En vivo',
    ANSWER_REVEAL: 'Revelación',
    LEADERBOARD: 'Clasificación',
    FINISHED: 'Finalizada',
  },
  fr: {
    WAITING: 'En attente',
    STARTING: 'Démarrage',
    PLAYING: 'En direct',
    ANSWER_REVEAL: 'Révélation',
    LEADERBOARD: 'Classement',
    FINISHED: 'Terminée',
  },
  ru: {
    WAITING: 'Ожидание',
    STARTING: 'Запуск',
    PLAYING: 'В эфире',
    ANSWER_REVEAL: 'Ответ',
    LEADERBOARD: 'Рейтинг',
    FINISHED: 'Завершена',
  },
  zh: {
    WAITING: '等待中',
    STARTING: '即将开始',
    PLAYING: '直播中',
    ANSWER_REVEAL: '揭晓答案',
    LEADERBOARD: '排行榜',
    FINISHED: '已结束',
  },
  ja: {
    WAITING: '待機中',
    STARTING: '開始中',
    PLAYING: 'ライブ中',
    ANSWER_REVEAL: '解答発表',
    LEADERBOARD: 'ランキング',
    FINISHED: '終了',
  },
  ar: {
    WAITING: 'قيد الانتظار',
    STARTING: 'جاري البدء',
    PLAYING: 'مباشر',
    ANSWER_REVEAL: 'كشف الإجابة',
    LEADERBOARD: 'الترتيب',
    FINISHED: 'منتهية',
  },
};
