import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 미생물학 기말 - 장(단원)별 20문제 세트 8개
// 객관식은 단답 매칭뿐 아니라 개념·기전·"옳은/틀린 것 고르기"를 섞었다.

const COMMON = { subject: '기타', grade: '기타' }

const sets = [
  {
    set: {
      id: 'set-micro-ch12',
      title: '미생물학 12장 - 감염증론',
      description:
        '감염·발병의 정의, 정착, 병원성과 독력(LD50), 침습성, 협막, 균체외효소, 외독소·내독소, 전파·변모 등 감염증론 핵심 20문제.',
      tags: ['미생물학', '12장', '감염증론', '독소', '병원성'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text:
          '병원미생물이 침입 경로를 통해 숙주 체내에 들어와 정착·증식하는 현상을 무엇이라 하는가?',
        options: ['감염(Infection)', '발병(Pathogenesis)', '잠복(Latency)', '회복(Recovery)'],
        answer: '감염(Infection)',
      },
      {
        type: 'CHOICE',
        question_text: '사람에서 다른 사람으로 전파될 수 있는 감염증을 특별히 지칭하는 용어는?',
        options: ['전염병(Communicable Disease)', '감염증', '발병', '잠복감염'],
        answer: '전염병(Communicable Disease)',
      },
      {
        type: 'OX',
        question_text:
          '병원균과 비병원균의 구분은 절대적인 것이 아니라, 숙주의 면역 상태나 침입 경로 등에 따라 달라지는 상대적 개념이다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text:
          '감염 성립의 첫 단계인 정착에서 세균의 섬모(정착인자)와 특이적으로 결합하는 숙주 세포의 구조는?',
        options: ['수용체(Receptor)', '협막', '편모', '포자'],
        answer: '수용체(Receptor)',
      },
      {
        type: 'CHOICE',
        question_text:
          '병원체가 침입하여 발증에 이르기까지의 기간으로, 병원체의 양·독력·숙주 감수성에 따라 달라지는 것은?',
        options: ['잠복기(Incubation Period)', '전구증상', '회복기', '이뇨기'],
        answer: '잠복기(Incubation Period)',
      },
      {
        type: 'CHOICE',
        question_text: '병원성(Pathogenicity)에 대한 설명으로 가장 옳은 것은?',
        options: [
          '질병을 일으킬 수 있는지 여부를 나타내는 질적 개념이다',
          'LD50으로 측정하는 양적 지표이다',
          'Gram 음성균 세포벽의 LPS 성분이다',
          '식균작용을 방해하는 협막을 의미한다',
        ],
        answer: '질병을 일으킬 수 있는지 여부를 나타내는 질적 개념이다',
      },
      {
        type: 'CHOICE',
        question_text: '독력(Virulence)과 LD50의 관계로 옳은 것은?',
        options: [
          'LD50이 낮을수록 독력이 강하다',
          'LD50이 높을수록 독력이 강하다',
          'LD50은 독력과 무관하다',
          'LD50은 병원성의 질적 표현이다',
        ],
        answer: 'LD50이 낮을수록 독력이 강하다',
      },
      {
        type: 'CHOICE',
        question_text: '다음 중 "편성 세포 내 증식 기생체"(세포 내에서만 증식)에 해당하지 않는 것은?',
        options: [
          'Salmonella typhi(장티푸스균)',
          '바이러스(Virus)',
          'Rickettsia(리케차)',
          'Chlamydia(클라미디아)',
        ],
        answer: 'Salmonella typhi(장티푸스균)',
      },
      {
        type: 'CHOICE',
        question_text: '폐렴구균이나 헤모필루스 인플루엔자의 협막(Capsule)이 균력을 강화하는 주된 기전은?',
        options: ['식균작용을 방해한다', '독소를 분비한다', '운동성을 부여한다', '포자를 형성한다'],
        answer: '식균작용을 방해한다',
      },
      {
        type: 'CHOICE',
        question_text: '황색포도구균이 생산하며 혈장을 응고시켜 균을 보호하는 균체외효소는?',
        options: ['Coagulase(응고효소)', 'Streptokinase', 'Hyaluronidase', 'Collagenase'],
        answer: 'Coagulase(응고효소)',
      },
      {
        type: 'CHOICE',
        question_text: '결합조직의 히알루론산을 분해하여 균의 침습성을 강화하는 효소는?',
        options: ['Hyaluronidase', 'Coagulase', 'Streptokinase', 'Collagenase'],
        answer: 'Hyaluronidase',
      },
      {
        type: 'CHOICE',
        question_text: '균체외독소(Exotoxin)의 특징으로 옳은 것은?',
        options: [
          '열에 약한 단백질성 독소이며 미량으로도 강력한 독성을 보인다',
          'Gram 음성균 세포벽 LPS 성분이다',
          '열에 매우 강한 내열성을 가진다',
          '세균이 사멸할 때만 유리된다',
        ],
        answer: '열에 약한 단백질성 독소이며 미량으로도 강력한 독성을 보인다',
      },
      {
        type: 'CHOICE',
        question_text: '균체내독소(Endotoxin)의 화학적 본체는?',
        options: ['리포다당(LPS)', '단백독소', '핵산', '펩티도글리칸'],
        answer: '리포다당(LPS)',
      },
      {
        type: 'CHOICE',
        question_text: '내독소(LPS) 구조 중 실제적인 독성을 나타내는 핵심 부위는?',
        options: ['Lipid A', 'O 항원', '협막', 'M 단백질'],
        answer: 'Lipid A',
      },
      {
        type: 'OX',
        question_text:
          '외독소는 포르말린 처리로 톡소이드를 만들어 백신으로 쓸 수 있으나, 내독소는 그렇게 무독화하기 어렵다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '균혈증 시 대량의 내독소가 유리될 때 나타나는 임상 증상이 아닌 것은?',
        options: [
          '근육의 이완성 마비',
          '고열',
          '파급성 혈관내 응고증(DIC)',
          '내독소 쇼크',
        ],
        answer: '근육의 이완성 마비',
      },
      {
        type: 'CHOICE',
        question_text:
          '항생물질 투여로 정상 세균총의 감수성 균이 사멸하고 내성 미생물이 비정상적으로 증식해 새 감염을 일으키는 현상은?',
        options: ['균교대증(Super infection)', '불현성 감염', '재발', '복수균 감염'],
        answer: '균교대증(Super infection)',
      },
      {
        type: 'CHOICE',
        question_text: '건강한 사람에게는 무해한 미생물이 숙주의 저항력이 낮아진 틈을 타 감염을 일으키는 현상은?',
        options: ['기회감염', '잠복감염', '불현성감염', '균혈증'],
        answer: '기회감염',
      },
      {
        type: 'CHOICE',
        question_text: '병원체의 전파 경로 중 혈류를 따라 전신적으로 확산되어 가장 위험한 것은?',
        options: ['혈행성 전파', '연속적 전파', '관강 내 전파', '림프행성 전파'],
        answer: '혈행성 전파',
      },
      {
        type: 'SHORT',
        question_text: "독력의 강도를 나타내는 지표인 '50% 치사량'을 뜻하는 영문 약어를 쓰시오.",
        options: [],
        answer: 'LD50',
      },
    ],
  },

  {
    set: {
      id: 'set-micro-ch15',
      title: '미생물학 15장 - 피부감염',
      description:
        '피부 구조와 상재균총, 황색포도구균·연쇄구균 감염, 탄저·리케치아·라임병, 수두/대상포진·홍역·풍진, 칸디다·백선·전풍 등 피부감염 핵심 20문제.',
      tags: ['미생물학', '15장', '피부감염', '진균', '바이러스'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: '피부 3층 중 혈관·림프관·모낭·한선을 포함하며, 모낭·한선이 미생물의 침입구 역할을 하는 층은?',
        options: ['진피(Dermis)', '표피(Epidermis)', '피하지방층', '각질층'],
        answer: '진피(Dermis)',
      },
      {
        type: 'CHOICE',
        question_text: '피부 표면의 pH 4.0~6.8 산성 환경이 하는 주된 역할은?',
        options: ['미생물 발육 억제', '수분 흡수 촉진', '체온 상승', '멜라닌 합성'],
        answer: '미생물 발육 억제',
      },
      {
        type: 'CHOICE',
        question_text: '청소년기 피지 과다 분비로 모낭·피지선에서 혐기성 증식하여 여드름을 일으키는 Gram 양성 간균은?',
        options: [
          'Propionibacterium acnes(여드름균)',
          'Staphylococcus epidermidis',
          'Malassezia furfur',
          'Corynebacterium diphtheriae',
        ],
        answer: 'Propionibacterium acnes(여드름균)',
      },
      {
        type: 'CHOICE',
        question_text: '여러 개의 부스럼이 융합되어 더 깊고 넓은 화농을 형성하며 발열·전신 증상을 동반할 수 있는 것은?',
        options: ['종기(Carbuncle)', '모낭염(Folliculitis)', '부스럼(Furuncle)', '농가진(Impetigo)'],
        answer: '종기(Carbuncle)',
      },
      {
        type: 'CHOICE',
        question_text:
          '포도구균성 표피박탈증후군(SSSS)에서 표피박탈독소(Exfoliatin)가 과립층에서 분해하는 표적 단백질은?',
        options: ['Desmoglein-1', '콜라겐', '히알루론산', '펩티도글리칸'],
        answer: 'Desmoglein-1',
      },
      {
        type: 'CHOICE',
        question_text: '황색포도구균의 독력인자 중 단백질 A(Protein A)의 기능은?',
        options: [
          '항체의 Fc 부위와 결합하여 식균작용을 저해',
          '혈장을 응고시켜 균을 보호',
          '적혈구를 용혈',
          '표피층을 박리',
        ],
        answer: '항체의 Fc 부위와 결합하여 식균작용을 저해',
      },
      {
        type: 'CHOICE',
        question_text:
          'A군 β-용혈성 연쇄구균 감염 1~3주 뒤 면역복합체가 신장 사구체에 침착하여 발생하는 합병증은?',
        options: ['급성사구체신염', '류마티스성 심내막염', '봉와직염', '단독'],
        answer: '급성사구체신염',
      },
      {
        type: 'CHOICE',
        question_text: '단독(Erysipelas)과 봉와직염(Cellulitis)의 침범 깊이 비교로 옳은 것은?',
        options: [
          '봉와직염이 진피 심층부와 피하 지방층까지 더 깊게 침범한다',
          '단독이 피하지방까지 더 깊게 침범한다',
          '둘 다 표피에만 국한된다',
          '둘 다 뼈까지 침범한다',
        ],
        answer: '봉와직염이 진피 심층부와 피하 지방층까지 더 깊게 침범한다',
      },
      {
        type: 'CHOICE',
        question_text: '탄저병(Anthrax)의 병원체와 그 특징으로 옳은 것은?',
        options: [
          'Bacillus anthracis - 아포(Endospore)를 형성하여 토양에서 장기 생존',
          'Borrelia burgdorferi - 나선상 세균',
          'Rickettsia rickettsii - 진드기 매개',
          'Treponema pallidum - 인공배양 불가',
        ],
        answer: 'Bacillus anthracis - 아포(Endospore)를 형성하여 토양에서 장기 생존',
      },
      {
        type: 'CHOICE',
        question_text: '탄저독소(Anthrax toxin)를 구성하는 세 가지 인자의 조합으로 옳은 것은?',
        options: [
          '방어항원(PA) + 부종인자(EF) + 치사인자(LF)',
          '용혈소 + 응고효소 + 단백질A',
          'Lipid A + O항원 + 핵심다당',
          'TSST-1 + 표피박탈독소 + 장독소',
        ],
        answer: '방어항원(PA) + 부종인자(EF) + 치사인자(LF)',
      },
      {
        type: 'CHOICE',
        question_text: '진드기(Tick)가 매개하며 Rickettsia rickettsii가 일으키는, 손발바닥에서 시작하는 점상 출혈성 발진이 특징인 질환은?',
        options: ['록키산홍반열', '발진티푸스', '라임병', '쯔쯔가무시증'],
        answer: '록키산홍반열',
      },
      {
        type: 'CHOICE',
        question_text: '사슴진드기가 매개하고 Borrelia burgdorferi가 일으키며, 과녁 모양의 이동성 홍반이 특징인 질환은?',
        options: ['라임병', '록키산홍반열', '발진티푸스', '탄저병'],
        answer: '라임병',
      },
      {
        type: 'CHOICE',
        question_text: '수두(Varicella)의 발진이 진행하는 순서로 옳은 것은?',
        options: [
          '반점 → 구진 → 수포 → 농포 → 가피',
          '수포 → 반점 → 가피 → 구진 → 농포',
          '가피 → 농포 → 수포 → 구진 → 반점',
          '구진 → 가피 → 반점 → 수포 → 농포',
        ],
        answer: '반점 → 구진 → 수포 → 농포 → 가피',
      },
      {
        type: 'CHOICE',
        question_text: '대상포진(Herpes Zoster)의 발병 기전으로 옳은 것은?',
        options: [
          'VZV가 척수 후근신경절에 잠복해 있다가 면역력 저하 시 재활성화되어 피부분절을 따라 발진',
          '처음 감염 시 전신 수포성 발진을 일으킴',
          'HSV-1이 삼차신경절에 잠복',
          '항원-항체 복합체가 사구체에 침착',
        ],
        answer: 'VZV가 척수 후근신경절에 잠복해 있다가 면역력 저하 시 재활성화되어 피부분절을 따라 발진',
      },
      {
        type: 'OX',
        question_text: '수두는 전염성이 강하지만, 대상포진은 상대적으로 전염성이 낮다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: "홍역(Measles)에서 발진 출현 전 구강 점막에 나타나는 특징적인 흰색 반점은?",
        options: ["Koplik's spot", '안장코', '이동성 홍반', '경성하감'],
        answer: "Koplik's spot",
      },
      {
        type: 'CHOICE',
        question_text: '임산부가 풍진(Rubella)에 감염되었을 때 태아에게 나타날 수 있는 것은?',
        options: ['선천성 풍진 증후군(심장·눈·뇌 기형)', '포진 후 신경통', '급성사구체신염', '아구창'],
        answer: '선천성 풍진 증후군(심장·눈·뇌 기형)',
      },
      {
        type: 'CHOICE',
        question_text: '구강·질·위장관 점막의 정상 상재균이나 면역 저하 시 기회감염을 일으키는 효모형 진균은?',
        options: ['Candida albicans', 'Trichophyton rubrum', 'Malassezia furfur', 'Microsporum canis'],
        answer: 'Candida albicans',
      },
      {
        type: 'CHOICE',
        question_text: '족부백선(무좀) 중 가장 흔한 병형으로, 발가락 사이가 짓무르고 심한 소양감을 보이는 것은?',
        options: ['지간형', '소수포형', '각화형', '조갑형'],
        answer: '지간형',
      },
      {
        type: 'SHORT',
        question_text:
          '백선 진단 시 병변 부위 각질을 긁어내어 균사와 포자를 직접 관찰하는 도말 검사의 이름을 쓰시오. (시약 약어 포함, 예: ○○○ 도말검사)',
        options: [],
        answer: 'KOH',
      },
    ],
  },

  {
    set: {
      id: 'set-micro-ch16',
      title: '미생물학 16장 - 호흡기 계통 감염',
      description:
        '호흡기 구조·방어기전, 연쇄구균 인두염·디프테리아, 감기·아데노바이러스, 폐렴구균·마이코플라스마·백일해·결핵·재향군인병, 독감·RSV·한탄바이러스 등 핵심 20문제.',
      tags: ['미생물학', '16장', '호흡기', '폐렴', '결핵'],
      ...COMMON,
    },
    questions: [
      {
        type: 'OX',
        question_text: '건강한 사람의 폐·폐포 등 하부호흡기에는 정상적으로 미생물이 거의 존재하지 않는다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '다음 중 호흡기계의 방어기전에 해당하지 않는 것은?',
        options: ['위산(Gastric acid)', '점막섬모운동', '분비형 IgA', '후두개 반사'],
        answer: '위산(Gastric acid)',
      },
      {
        type: 'CHOICE',
        question_text: '기관·기관지 표면의 섬모상피세포가 분비액과 함께 세균을 호흡기 밖으로 배출하는 여과 시스템은?',
        options: ['점막섬모운동(Muco-ciliary escalator)', '후두개 반사', '대식세포 식균작용', '체액성 면역'],
        answer: '점막섬모운동(Muco-ciliary escalator)',
      },
      {
        type: 'CHOICE',
        question_text: 'A군 β-용혈성 연쇄구균 인두염을 적절히 치료하지 않을 때 자가면역 반응으로 생길 수 있는 합병증은?',
        options: ['류마티스성열·사구체신염', '아구창', '포진 후 신경통', '대상포진'],
        answer: '류마티스성열·사구체신염',
      },
      {
        type: 'CHOICE',
        question_text: '화농성연쇄구균이 대식세포의 식균작용에 저항하는 데 관여하는 인자는?',
        options: ['M 단백질과 히알루론산 협막', '협막 다당 LPS', '역전사효소', 'Urease'],
        answer: 'M 단백질과 히알루론산 협막',
      },
      {
        type: 'CHOICE',
        question_text: '디프테리아(Diphtheria)에 대한 설명으로 옳은 것은?',
        options: [
          'Corynebacterium diphtheriae가 인후에 회백색 위점막을 형성한다',
          'Gram 음성 쌍구균이 원인이다',
          '항산성 염색에 양성이다',
          '주로 모기에 의해 전파된다',
        ],
        answer: 'Corynebacterium diphtheriae가 인후에 회백색 위점막을 형성한다',
      },
      {
        type: 'CHOICE',
        question_text: '디프테리아 외독소(Exotoxin)가 세포를 죽이는 기전은?',
        options: [
          '단백질 합성을 방해하여 세포를 사멸시킨다',
          '세포막 레시틴을 분해한다',
          '아세틸콜린 방출을 차단한다',
          '적혈구를 용혈시킨다',
        ],
        answer: '단백질 합성을 방해하여 세포를 사멸시킨다',
      },
      {
        type: 'CHOICE',
        question_text: '감기(Common Cold)의 가장 흔한 원인 바이러스는?',
        options: ['Rhinovirus', 'Influenza virus', 'Adenovirus', 'RSV'],
        answer: 'Rhinovirus',
      },
      {
        type: 'CHOICE',
        question_text: "오염된 수영장 물을 통해 집단 발병할 수 있는 아데노바이러스의 비인두결막염은 흔히 무엇이라 불리는가?",
        options: ['수영장 풀열', '걸어다니는 폐렴', '대엽성 폐렴', '양털 분류자 병'],
        answer: '수영장 풀열',
      },
      {
        type: 'CHOICE',
        question_text: '폐렴구균성 폐렴(Pneumococcal Pneumonia)의 특징으로 옳은 것은?',
        options: [
          '녹슨 쇳빛 객담과 란셋형 쌍구균, 대엽성 폐렴이 특징이다',
          '붉은 젤리 모양 객담이 특징이다',
          '세포벽이 없어 걸어다니는 폐렴이라 불린다',
          '냉각탑수를 통해 전파된다',
        ],
        answer: '녹슨 쇳빛 객담과 란셋형 쌍구균, 대엽성 폐렴이 특징이다',
      },
      {
        type: 'CHOICE',
        question_text: '소아·청소년에게 흔하고 세포벽이 없으며 "걸어다니는 폐렴"으로 불리는 폐렴의 원인균은?',
        options: ['Mycoplasma pneumoniae', 'Streptococcus pneumoniae', 'Klebsiella pneumoniae', 'Legionella pneumophila'],
        answer: 'Mycoplasma pneumoniae',
      },
      {
        type: 'CHOICE',
        question_text: '발작기에 짧고 잦은 기침 후 길게 숨을 들이쉴 때 "흡(Whoop)" 소리가 나는 백일해의 원인균은?',
        options: ['Bordetella pertussis', 'Corynebacterium diphtheriae', 'Mycobacterium tuberculosis', 'Legionella pneumophila'],
        answer: 'Bordetella pertussis',
      },
      {
        type: 'CHOICE',
        question_text: '결핵(Tuberculosis)에 대한 설명으로 옳은 것은?',
        options: [
          '항산성 염색에 양성이며 BCG 백신으로 예방하고 항결핵제를 6개월 이상 복합 투여한다',
          'Gram 음성 쌍구균이 원인이다',
          '톡소이드 백신으로 예방한다',
          '주로 모기를 통해 전파된다',
        ],
        answer: '항산성 염색에 양성이며 BCG 백신으로 예방하고 항결핵제를 6개월 이상 복합 투여한다',
      },
      {
        type: 'CHOICE',
        question_text: '재향군인병(Legionnaires’ Disease)의 전파 경로로 옳은 것은?',
        options: [
          '에어컨 냉각탑수 등 오염된 물의 비말 흡입(사람 간 직접 전파 없음)',
          '모기에 물려 전파',
          '쥐 배설물 흡입',
          '성적 접촉',
        ],
        answer: '에어컨 냉각탑수 등 오염된 물의 비말 흡입(사람 간 직접 전파 없음)',
      },
      {
        type: 'CHOICE',
        question_text: '인플루엔자 바이러스 표면의 스파이크 단백질 2종은?',
        options: [
          'Hemagglutinin(H)과 Neuraminidase(N)',
          'gp120과 gp41',
          'M 단백질과 단백질 A',
          'PA와 LF',
        ],
        answer: 'Hemagglutinin(H)과 Neuraminidase(N)',
      },
      {
        type: 'CHOICE',
        question_text: '영유아(특히 1세 미만)의 중증 폐렴·세기관지염 주요 원인이며 감염 세포가 융합해 합포체(Syncytia)를 형성하는 바이러스는?',
        options: ['RSV(호흡기세포융합바이러스)', 'Influenza virus', 'Rhinovirus', 'Hantavirus'],
        answer: 'RSV(호흡기세포융합바이러스)',
      },
      {
        type: 'CHOICE',
        question_text: '한탄바이러스 신증후출혈열의 주요 숙주와 전파 방식으로 옳은 것은?',
        options: [
          '등줄쥐 배설물에 오염된 먼지를 호흡기로 흡입(사람 간 전파 없음)',
          '모기에 물려 전파',
          '성적 접촉으로 전파',
          '오염된 어패류 섭취',
        ],
        answer: '등줄쥐 배설물에 오염된 먼지를 호흡기로 흡입(사람 간 전파 없음)',
      },
      {
        type: 'OX',
        question_text:
          '조류 인플루엔자(H5N1)는 현재 사람 간 전파 능력이 매우 낮으나, 유전자 재조합(항원 대변이)이 일어나면 대유행 위험이 있다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '정상 면역인에게는 병을 일으키지 않으나 AIDS 등 면역저하자에게 치명적인 대표적 기회감염성 폐렴은?',
        options: ['카리니 주폐포자충 폐렴(PCP)', '폐렴구균성 폐렴', '백일해', '디프테리아'],
        answer: '카리니 주폐포자충 폐렴(PCP)',
      },
      {
        type: 'SHORT',
        question_text: '디프테리아·백일해·파상풍을 함께 예방하는 혼합백신의 약어를 쓰시오.',
        options: [],
        answer: 'DPT',
      },
    ],
  },

  {
    set: {
      id: 'set-micro-ch17',
      title: '미생물학 17장 - 소화기 계통 감염',
      description:
        '위장관 상재균, 치아우식·치주질환·H.pylori, 단순포진·이하선염, 콜레라·이질·대장균·살모넬라·캄필로박터, 로타·노로·간염, 아메바성 이질 등 핵심 20문제.',
      tags: ['미생물학', '17장', '소화기', '식중독', '간염'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: '구강 내 정상 상재균총의 대부분을 차지하며 당 대사로 젖산을 생성하는 Gram 양성균은?',
        options: ['연쇄상구균(Streptococcus)', 'Bacteroides', 'Candida', 'Veillonella'],
        answer: '연쇄상구균(Streptococcus)',
      },
      {
        type: 'CHOICE',
        question_text: '치아우식증(충치)의 주요 병원체로, 치태(치석)를 형성하는 균은?',
        options: ['Streptococcus mutans', 'Helicobacter pylori', 'Lactobacillus', 'Actinomyces'],
        answer: 'Streptococcus mutans',
      },
      {
        type: 'CHOICE',
        question_text: '치아우식의 발생 기전으로 옳은 것은?',
        options: [
          '자당을 동화해 Dextran을 형성·부착하고 젖산으로 에나멜을 용해한다',
          'Urease로 위산을 중화한다',
          '베로독소로 상피를 파괴한다',
          '아세틸콜린 방출을 차단한다',
        ],
        answer: '자당을 동화해 Dextran을 형성·부착하고 젖산으로 에나멜을 용해한다',
      },
      {
        type: 'CHOICE',
        question_text: 'Helicobacter pylori가 산성 위 환경에서 생존하는 핵심 기전은?',
        options: [
          '강력한 Urease로 요소를 암모니아로 분해해 위산을 중화한다',
          '두꺼운 협막으로 위산을 차단한다',
          '아포를 형성해 휴면한다',
          '내독소를 방출한다',
        ],
        answer: '강력한 Urease로 요소를 암모니아로 분해해 위산을 중화한다',
      },
      {
        type: 'CHOICE',
        question_text: '단순포진(HSV-1)이 재발을 위해 잠복하는 부위는?',
        options: ['삼차신경절', '척수 후근신경절', '담낭', '사구체'],
        answer: '삼차신경절',
      },
      {
        type: 'CHOICE',
        question_text: '유행성 이하선염(Mumps)에서 사춘기 이후 남성에게 나타날 수 있는 합병증은?',
        options: ['고환염(불임 가능)', '난소염', '각막염', '아구창'],
        answer: '고환염(불임 가능)',
      },
      {
        type: 'CHOICE',
        question_text: '콜레라 독소(Enterotoxin)의 작용으로 옳은 것은?',
        options: [
          '장관 상피세포에 작용해 수분·전해질을 대량 유출시켜 쌀뜨물 같은 설사를 유발',
          '신경 전달을 차단해 마비를 유발',
          '적혈구를 파괴해 빈혈을 유발',
          '간세포를 파괴해 황달을 유발',
        ],
        answer: '장관 상피세포에 작용해 수분·전해질을 대량 유출시켜 쌀뜨물 같은 설사를 유발',
      },
      {
        type: 'CHOICE',
        question_text: '장 상피세포에 침윤·증식하여 농·혈변과 장 궤양을 일으키는 Gram 음성 비운동성 간균은?',
        options: ['Shigella(세균성 이질)', 'Vibrio cholerae', 'Salmonella Typhi', 'Campylobacter jejuni'],
        answer: 'Shigella(세균성 이질)',
      },
      {
        type: 'CHOICE',
        question_text: '베로독소를 생산해 용혈성 요독 증후군(HUS)을 유발할 수 있는 장관출혈성 대장균의 대표 혈청형은?',
        options: ['O157:H7', 'L1·L2·L3', 'H5N1', 'PRSP'],
        answer: 'O157:H7',
      },
      {
        type: 'CHOICE',
        question_text: '콜레라 독소와 유사한 독소를 방출하여 수양성 설사를 일으키는 장관독소원성 대장균의 약어는?',
        options: ['ETEC', 'EHEC', 'EIEC', 'EPEC'],
        answer: 'ETEC',
      },
      {
        type: 'CHOICE',
        question_text: '장티푸스(Typhoid Fever)에 대한 설명으로 옳은 것은?',
        options: [
          'Salmonella Typhi가 일으키는 장열형으로 고열·비장 종대가 특징이다',
          'Vibrio cholerae가 쌀뜨물 설사를 일으킨다',
          'Shigella가 세포 내 침윤한다',
          'Rotavirus가 영유아 설사를 일으킨다',
        ],
        answer: 'Salmonella Typhi가 일으키는 장열형으로 고열·비장 종대가 특징이다',
      },
      {
        type: 'CHOICE',
        question_text: '장티푸스 회복 후에도 균을 보유·배설하는 보균자에서 균이 주로 잠복하는 장기는?',
        options: ['담낭(Gallbladder)', '폐', '신장', '뇌'],
        answer: '담낭(Gallbladder)',
      },
      {
        type: 'CHOICE',
        question_text: '생후 6~24개월 영유아의 가장 흔한 설사병 원인이며 수레바퀴 모양을 보이는 바이러스는?',
        options: ['Rotavirus', 'Norwalk virus(노로바이러스)', 'HAV', 'Adenovirus'],
        answer: 'Rotavirus',
      },
      {
        type: 'CHOICE',
        question_text: '"겨울철 구토병"으로 불리며 백신이 없는, 단일가닥 RNA 위장염 바이러스는?',
        options: ['노로바이러스(Norwalk virus)', '로타바이러스', 'A형 간염 바이러스', 'B형 간염 바이러스'],
        answer: '노로바이러스(Norwalk virus)',
      },
      {
        type: 'CHOICE',
        question_text: 'B형 간염과 C형 간염의 만성화율 비교로 옳은 것은?',
        options: [
          'B형은 약 5~10%, C형은 약 70~85% 만성화한다',
          'B형은 약 70~85%, C형은 약 5~10% 만성화한다',
          '둘 다 거의 만성화하지 않는다',
          '둘 다 100% 만성화한다',
        ],
        answer: 'B형은 약 5~10%, C형은 약 70~85% 만성화한다',
      },
      {
        type: 'CHOICE',
        question_text: 'A형 간염의 주된 전파 경로는?',
        options: ['분변-구강 경로(오염된 물·음식)', '혈액·성적 접촉', '모기 매개', '호흡기 비말'],
        answer: '분변-구강 경로(오염된 물·음식)',
      },
      {
        type: 'OX',
        question_text:
          '특이적 항바이러스제가 없는 바이러스성 위장염에서는 수분·전해질 공급을 통한 탈수 방지가 가장 중요한 치료이다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '심한 복통과 농·혈변, 점액성 설사를 일으키는 원충성 이질의 병원체는?',
        options: ['Entamoeba histolytica', 'Giardia lamblia', 'Cryptosporidium', 'Cyclospora'],
        answer: 'Entamoeba histolytica',
      },
      {
        type: 'CHOICE',
        question_text: '독소형 식중독과 감염형 식중독의 검사 재료 차이로 옳은 것은?',
        options: [
          '독소형은 주로 식품·구토물에서 독소를 증명하고, 감염형은 주로 분변에서 원인균을 분리·동정한다',
          '둘 다 혈액에서 항체를 측정한다',
          '독소형은 분변, 감염형은 식품을 사용한다',
          '둘 다 객담을 사용한다',
        ],
        answer: '독소형은 주로 식품·구토물에서 독소를 증명하고, 감염형은 주로 분변에서 원인균을 분리·동정한다',
      },
      {
        type: 'SHORT',
        question_text: '대장의 정상 상재균인 대장균(E. coli)이 장내에서 합성하는 비타민의 종류를 쓰시오. (예: 비타민 ○)',
        options: [],
        answer: '비타민 K',
      },
    ],
  },

  {
    set: {
      id: 'set-micro-ch18',
      title: '미생물학 18장 - 비뇨생식기 감염',
      description:
        '비뇨기 구조·방어, 방광염·신우신염·렙토스피라, 세균성 질염·칸디다·TSS, 임질·클라미디아·매독·HPV·AIDS·트리코모나스 등 비뇨생식기 감염 핵심 20문제.',
      tags: ['미생물학', '18장', '비뇨생식기', '성매개질환', 'STD'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: '여성 질에서 지배적인 정상 상재균으로, 글리코겐을 분해해 젖산을 생성하여 pH 4.5 이하를 유지하는 균은?',
        options: ['Lactobacillus spp.', 'Gardnerella vaginalis', 'Candida albicans', 'Escherichia coli'],
        answer: 'Lactobacillus spp.',
      },
      {
        type: 'CHOICE',
        question_text: '세균성 방광염의 약 80~90%를 차지하는 원인균이며 요도를 타고 올라가는 상행성 감염의 주범은?',
        options: ['Escherichia coli(대장균)', 'Staphylococcus aureus', 'Neisseria gonorrhoeae', 'Lactobacillus'],
        answer: 'Escherichia coli(대장균)',
      },
      {
        type: 'CHOICE',
        question_text: '여성에게 방광염·요로감염이 흔한 주된 해부학적 이유는?',
        options: ['요도가 짧기 때문', '방광이 크기 때문', '신장이 하나뿐이라서', '질이 산성이라서'],
        answer: '요도가 짧기 때문',
      },
      {
        type: 'CHOICE',
        question_text: '쥐 등 동물의 소변에 오염된 물·흙 접촉으로 감염되며 중증 시 황달·신부전(Weil병)을 일으키는 인수공통 나선형 세균은?',
        options: ['Leptospira interrogans', 'Gardnerella vaginalis', 'Treponema pallidum', 'Borrelia burgdorferi'],
        answer: 'Leptospira interrogans',
      },
      {
        type: 'CHOICE',
        question_text: '세균성 질염(Bacterial Vaginosis)에 대한 설명으로 옳은 것은?',
        options: [
          'Gardnerella vaginalis가 관여하고 Lactobacillus 감소로 생선 비린내가 나며 비전염성이다',
          'Candida가 치즈 모양 분비물을 일으킨다',
          'TSST-1 독소로 쇼크를 일으킨다',
          '성적 접촉으로만 전파되는 성병이다',
        ],
        answer: 'Gardnerella vaginalis가 관여하고 Lactobacillus 감소로 생선 비린내가 나며 비전염성이다',
      },
      {
        type: 'CHOICE',
        question_text: '고흡수성 탐폰의 장시간 사용과 관련되며 황색포도구균의 TSST-1 독소가 일으키는 질환은?',
        options: ['독소성 쇽 증후군(TSS)', '세균성 질염', '외음질 칸디다증', '임질'],
        answer: '독소성 쇽 증후군(TSS)',
      },
      {
        type: 'CHOICE',
        question_text: '임질(Gonorrhea)의 병원체는?',
        options: ['Neisseria gonorrhoeae(Gram 음성 쌍구균)', 'Treponema pallidum', 'Chlamydia trachomatis', 'Trichomonas vaginalis'],
        answer: 'Neisseria gonorrhoeae(Gram 음성 쌍구균)',
      },
      {
        type: 'CHOICE',
        question_text: '임질에 감염된 산모에게서 분만 시 신생아에게 발생할 수 있는, 실명 위험이 있는 합병증은?',
        options: ['신생아 안염', '선천성 풍진 증후군', '봉입체성 결막염', '아구창'],
        answer: '신생아 안염',
      },
      {
        type: 'OX',
        question_text:
          '임질균은 항원 변이가 심해 한 번 감염되어도 면역이 형성되지 않으며 재감염이 흔하다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '70~80%가 무증상이며 비임균성 요도염을 일으키는, 절대 세포내 세균에 의한 성매개 감염의 병원체는?',
        options: ['Chlamydia trachomatis', 'Neisseria gonorrhoeae', 'Treponema pallidum', 'Haemophilus ducreyi'],
        answer: 'Chlamydia trachomatis',
      },
      {
        type: 'CHOICE',
        question_text: '매독(Syphilis) 제1기의 특징적 증상은?',
        options: ['무통성 궤양인 경성하감(Chancre)', '손바닥·발바닥의 전신 발진', '고무종(Gumma)', '신경매독'],
        answer: '무통성 궤양인 경성하감(Chancre)',
      },
      {
        type: 'CHOICE',
        question_text: '매독의 병원체로, 가늘고 긴 나선균이며 인공배양이 불가능한 것은?',
        options: ['Treponema pallidum', 'Neisseria gonorrhoeae', 'Chlamydia trachomatis', 'Gardnerella vaginalis'],
        answer: 'Treponema pallidum',
      },
      {
        type: 'CHOICE',
        question_text: '임신 중 태반을 통해 태아에게 전파된 선천매독에서 나타날 수 있는 징후는?',
        options: ["허친슨 치아(Hutchinson's teeth)·안장코", '신생아 안염', '카포시 육종', '아구창'],
        answer: "허친슨 치아(Hutchinson's teeth)·안장코",
      },
      {
        type: 'CHOICE',
        question_text: '음부포진(Genital Herpes)의 주된 병원체와 특징은?',
        options: [
          'HSV-2가 신경절에 잠복했다가 재활성화되어 재발',
          'HPV가 사마귀를 형성',
          'HIV가 CD4+ T세포를 파괴',
          'Treponema pallidum이 경성하감을 형성',
        ],
        answer: 'HSV-2가 신경절에 잠복했다가 재활성화되어 재발',
      },
      {
        type: 'CHOICE',
        question_text: '첨규콘딜로마(HPV) 중 자궁경부암·항문암을 유발하는 고위험군 혈청형은?',
        options: ['16형·18형', '6형·11형', 'L1·L2·L3', 'O157형'],
        answer: '16형·18형',
      },
      {
        type: 'CHOICE',
        question_text: 'AIDS에서 HIV가 파괴하여 심각한 면역 결핍을 일으키는 핵심 면역 세포는?',
        options: ['CD4+ T세포', 'B 림프구', '적혈구', '혈소판'],
        answer: 'CD4+ T세포',
      },
      {
        type: 'CHOICE',
        question_text: 'HIV(Retrovirus)가 자신의 RNA를 DNA로 바꿔 숙주 유전체에 통합하는 데 사용하는 효소는?',
        options: ['역전사효소(Reverse transcriptase)', 'Urease', 'Coagulase', 'Lecithinase'],
        answer: '역전사효소(Reverse transcriptase)',
      },
      {
        type: 'CHOICE',
        question_text: 'AIDS 환자에게 흔히 발생하는 대표적 기회감염·종양이 아닌 것은?',
        options: ['급성사구체신염', '주폐포자충 폐렴(PCP)', '카포시 육종', '거대세포바이러스(CMV) 감염'],
        answer: '급성사구체신염',
      },
      {
        type: 'CHOICE',
        question_text: '여성에게 악취 나는 황록색 분비물을 일으키며 Metronidazole로 치료하고 파트너 동시 치료가 필요한 원충성 성매개 질환은?',
        options: ['질트리코모나스증(Trichomonas vaginalis)', '세균성 질염', '외음질 칸디다증', '임질'],
        answer: '질트리코모나스증(Trichomonas vaginalis)',
      },
      {
        type: 'SHORT',
        question_text: '성매개 질환에서 재감염(핑퐁 감염)을 막기 위해 환자와 반드시 함께 치료해야 하는 대상을 쓰시오.',
        options: [],
        answer: '성 파트너',
      },
    ],
  },

  {
    set: {
      id: 'set-micro-ch19',
      title: '미생물학 19장 - 신경계 감염',
      description:
        '수막·BBB·CSF, 세균성 수막염·리스테리아·보툴리누스·나병, 바이러스성 수막염·폴리오·공수병·뇌염, 크립토코쿠스·수면병·프리온 등 신경계 감염 핵심 20문제.',
      tags: ['미생물학', '19장', '신경계', '수막염', '프리온'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: '수막(Meninges) 3층 중 가장 바깥에 있으며 질기고 두꺼운 막은?',
        options: ['경막(Dura mater)', '지주막(Arachnoid mater)', '유막(Pia mater)', '심막(Pericardium)'],
        answer: '경막(Dura mater)',
      },
      {
        type: 'CHOICE',
        question_text: '지주막과 유막 사이의 공간으로 뇌척수액(CSF)이 흐르는 곳은?',
        options: ['지주막하강', '경막외강', '뇌실', '심막강'],
        answer: '지주막하강',
      },
      {
        type: 'CHOICE',
        question_text: '혈액-뇌 장벽(BBB)의 선택적 투과성을 만드는 구조적 기반은?',
        options: ['모세혈관 내피세포의 밀착연접(Tight junction)', '협막', '섬모', '포자'],
        answer: '모세혈관 내피세포의 밀착연접(Tight junction)',
      },
      {
        type: 'CHOICE',
        question_text: '미생물이 중추신경계로 침입하는 경로 중 가장 흔한 것은?',
        options: ['혈류 전파(BBB 통과)', '인접 부위 전파', '외상·수술', '신경 경로'],
        answer: '혈류 전파(BBB 통과)',
      },
      {
        type: 'CHOICE',
        question_text: '과거 영유아 수막염의 가장 흔한 원인균이었으나 Hib 백신 도입 후 발생률이 급감한 균은?',
        options: ['Haemophilus influenzae b형', 'Neisseria meningitidis', 'Streptococcus pneumoniae', 'Listeria monocytogenes'],
        answer: 'Haemophilus influenzae b형',
      },
      {
        type: 'CHOICE',
        question_text: '군대·기숙사 등 밀집 환경에서 유행하며 내독소로 혈관 손상·쇼크를 일으키는 수막구균성 수막염의 원인균은?',
        options: ['Neisseria meningitidis', 'Haemophilus influenzae', 'Mycobacterium leprae', 'Clostridium tetani'],
        answer: 'Neisseria meningitidis',
      },
      {
        type: 'CHOICE',
        question_text: '냉장 온도(4℃)에서도 증식 가능하며 임산부 감염 시 태반을 통과해 유산·신생아 수막염을 일으키는 균은?',
        options: ['Listeria monocytogenes', 'Neisseria meningitidis', 'Clostridium botulinum', 'Cryptococcus neoformans'],
        answer: 'Listeria monocytogenes',
      },
      {
        type: 'CHOICE',
        question_text: '보툴리누스 독소(Botulinum toxin)의 작용 기전은?',
        options: [
          '신경-근 접합부에서 아세틸콜린 방출을 차단하여 이완성 마비를 유발',
          '억제성 신경 기능을 차단하여 강직성 경련을 유발',
          '단백질 합성을 방해',
          '적혈구를 용혈',
        ],
        answer: '신경-근 접합부에서 아세틸콜린 방출을 차단하여 이완성 마비를 유발',
      },
      {
        type: 'CHOICE',
        question_text: '파상풍과 보툴리누스의 마비 양상 차이로 옳은 것은?',
        options: [
          '파상풍은 강직성(경련) 마비, 보툴리누스는 이완성 마비',
          '파상풍은 이완성, 보툴리누스는 강직성 마비',
          '둘 다 강직성 마비',
          '둘 다 이완성 마비',
        ],
        answer: '파상풍은 강직성(경련) 마비, 보툴리누스는 이완성 마비',
      },
      {
        type: 'CHOICE',
        question_text: '나병(한센병)의 두 유형 중 세포성 면역 반응이 결핍되어 전신 결절·안면 변형을 보이고 전염성이 높으며 균이 다량 관찰되는 것은?',
        options: ['나결절형(나종형, Lepromatous)', '결핵양형(유결핵형, Tuberculoid)', '잠복형', '불현성형'],
        answer: '나결절형(나종형, Lepromatous)',
      },
      {
        type: 'CHOICE',
        question_text: '바이러스성(무균성) 수막염의 가장 흔한 원인 바이러스는?',
        options: ['Enterovirus', 'Rabies virus', 'Hantavirus', 'HPV'],
        answer: 'Enterovirus',
      },
      {
        type: 'CHOICE',
        question_text: '폴리오 백신 중 안전성을 고려해 현재 한국에서 표준으로 권고되는 것은?',
        options: ['Salk 백신(IPV, 불활성화 백신)', 'Sabin 백신(OPV, 약독화 생백신)', '톡소이드', 'BCG'],
        answer: 'Salk 백신(IPV, 불활성화 백신)',
      },
      {
        type: 'CHOICE',
        question_text: '공수병(광견병) 진단의 결정적 근거가 되는, 감염 뉴런 세포질 내 호산성 봉입체는?',
        options: ['Negri body', "Koplik's spot", 'Sulfur granule', 'Bubo'],
        answer: 'Negri body',
      },
      {
        type: 'CHOICE',
        question_text: '공수병 바이러스가 중추신경계에 도달하는 경로로 옳은 것은?',
        options: [
          '물린 부위 근육에서 증식 후 말초신경 축삭을 따라 역행성으로 CNS에 도달',
          '혈류를 타고 BBB를 통과',
          '림프관을 통해 전신 확산',
          '호흡기 흡입으로 폐를 거쳐 침입',
        ],
        answer: '물린 부위 근육에서 증식 후 말초신경 축삭을 따라 역행성으로 CNS에 도달',
      },
      {
        type: 'CHOICE',
        question_text: '일본뇌염을 매개하는 모기와 증폭 숙주의 조합으로 옳은 것은?',
        options: [
          '작은빨간집모기 - 돼지(증폭 숙주)',
          '이집트숲모기 - 조류',
          '학질모기 - 사람',
          '체체파리 - 소',
        ],
        answer: '작은빨간집모기 - 돼지(증폭 숙주)',
      },
      {
        type: 'CHOICE',
        question_text: '두꺼운 협막을 가진 효모양 진균으로, India ink 염색으로 진단하며 AIDS 환자에게 수막뇌염을 일으키는 것은?',
        options: ['Cryptococcus neoformans', 'Candida albicans', 'Histoplasma capsulatum', 'Aspergillus'],
        answer: 'Cryptococcus neoformans',
      },
      {
        type: 'CHOICE',
        question_text: '체체파리가 매개하고 항원 변이로 면역을 회피하는 원충성 신경계 질환은?',
        options: ['아프리카 수면병(Trypanosoma brucei)', '말라리아', '톡소플라스마증', '크립토코쿠스증'],
        answer: '아프리카 수면병(Trypanosoma brucei)',
      },
      {
        type: 'OX',
        question_text:
          '프리온 질환은 핵산이 없는 단백질성 감염 입자에 의해 발생하며 일반적인 소독법에 강한 저항성을 보인다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '프리온 질환(CJD 등)의 대표적인 뇌 조직 병리 소견은?',
        options: ['뇌 조직의 해면상 변화', '건락성 괴사', '대엽성 폐렴', '사구체 면역복합체 침착'],
        answer: '뇌 조직의 해면상 변화',
      },
      {
        type: 'SHORT',
        question_text: '파상풍균이 생성하여 중추신경계의 억제 신경 기능을 차단해 근육 강직·경련을 일으키는 외독소(신경독소)의 이름을 쓰시오.',
        options: [],
        answer: 'tetanospasmin',
      },
    ],
  },

  {
    set: {
      id: 'set-micro-ch20',
      title: '미생물학 20장 - 창상 감염',
      description:
        '농양·혐기성 농양, 포도구균·연쇄구균·녹농균·비브리오 불니피쿠스, 파상풍·가스괴저·방선균증, 동물·사람 교상, 진균 창상감염 등 핵심 20문제.',
      tags: ['미생물학', '20장', '창상감염', '혐기성', '교상'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: '피부의 염분·지질 환경에 내성이 있어 피부 표면에서 생존·증식할 수 있는 Gram 양성 세균은?',
        options: ['황색포도구균(Staphylococcus)·Micrococcus', 'Vibrio cholerae', 'Salmonella', 'Treponema pallidum'],
        answer: '황색포도구균(Staphylococcus)·Micrococcus',
      },
      {
        type: 'CHOICE',
        question_text: '피부 땀샘·모낭·상처에 흔히 감염되어 농양(Wound abscess)을 형성하는 대표적 균은?',
        options: ['포도구균(Staphylococcus)', '대장균', '녹농균', '파상풍균'],
        answer: '포도구균(Staphylococcus)',
      },
      {
        type: 'OX',
        question_text:
          '창상 부위 깊은 조직의 산소 결핍 조건에서는 감염의 상당수(약 60~70%)가 혐기성 세균에 의해 발생한다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '황색포도구균의 독력인자 중 Coagulase(혈장응고효소)의 기능은?',
        options: [
          '혈장의 fibrin을 응고시켜 균을 보호한다',
          'IgG Fc와 결합해 식균작용을 저해한다',
          '적혈구를 용혈시킨다',
          '히알루론산을 분해한다',
        ],
        answer: '혈장의 fibrin을 응고시켜 균을 보호한다',
      },
      {
        type: 'CHOICE',
        question_text: '황색포도구균의 단백질 A(Protein A)가 식균작용을 방해하는 기전은?',
        options: [
          'IgG의 Fc 부위와 결합하여 보체 활성화·식균현상을 방해한다',
          '혈장을 응고시킨다',
          '레시틴을 분해한다',
          '아세틸콜린 방출을 차단한다',
        ],
        answer: 'IgG의 Fc 부위와 결합하여 보체 활성화·식균현상을 방해한다',
      },
      {
        type: 'CHOICE',
        question_text: '수술 후 체내 정맥 내 도관(Catheter) 등 삽입 의료기구와 관련하여 감염을 잘 일으키는 균은?',
        options: ['Staphylococcus epidermidis(표피포도구균)', 'Staphylococcus aureus', 'Streptococcus pyogenes', 'Bacillus anthracis'],
        answer: 'Staphylococcus epidermidis(표피포도구균)',
      },
      {
        type: 'CHOICE',
        question_text: '일반적으로 비병원성 부생균이나 여성의 요도·방광에 감염되어 비뇨기계 염증을 일으키는 포도구균은?',
        options: ['Staphylococcus saprophyticus(부생성 포도구균)', 'Staphylococcus aureus', 'Staphylococcus epidermidis', 'Streptococcus pyogenes'],
        answer: 'Staphylococcus saprophyticus(부생성 포도구균)',
      },
      {
        type: 'CHOICE',
        question_text: 'A군 연쇄구균(S. pyogenes) 창상감염이 일으킬 수 있는 치명적 질환은?',
        options: ['괴사성 근막염(Necrotizing fasciitis)', '아구창', '대상포진', '아메바성 이질'],
        answer: '괴사성 근막염(Necrotizing fasciitis)',
      },
      {
        type: 'CHOICE',
        question_text: '녹농균(Pseudomonas aeruginosa)에 대한 설명으로 옳은 것은?',
        options: [
          '원내감염의 주요 원인균으로 녹색 화농을 형성하고 대부분의 항생제에 내성을 보인다',
          'Gram 양성 구균으로 포도송이 모양이다',
          '아포를 형성해 토양에서 장기 생존한다',
          '세포벽이 없어 걸어다니는 폐렴을 일으킨다',
        ],
        answer: '원내감염의 주요 원인균으로 녹색 화농을 형성하고 대부분의 항생제에 내성을 보인다',
      },
      {
        type: 'CHOICE',
        question_text: '호염성 세균으로 해수·어패류와 관련되며 간질환자 등 고위험군에서 상처 부위 수포·괴사를 일으키는 균은?',
        options: ['Vibrio vulnificus', 'Vibrio cholerae', 'Clostridium tetani', 'Bartonella henselae'],
        answer: 'Vibrio vulnificus',
      },
      {
        type: 'CHOICE',
        question_text: '파상풍에서 등이 아치형으로 휘는 고통스러운 전신성 경련 자세를 무엇이라 하는가?',
        options: ['후궁반장(Opisthotonus)', '개구불능(Lockjaw)', '이완성 마비', '연하곤란'],
        answer: '후궁반장(Opisthotonus)',
      },
      {
        type: 'CHOICE',
        question_text: '가스괴저(Gas gangrene)의 주요 원인균은?',
        options: ['Clostridium perfringens', 'Clostridium tetani', 'Actinomyces israelii', 'Pseudomonas aeruginosa'],
        answer: 'Clostridium perfringens',
      },
      {
        type: 'CHOICE',
        question_text: '가스괴저의 주요 독소인 α-독소(Lecithinase C)의 작용은?',
        options: [
          '세포막의 레시틴을 분해하여 적혈구·백혈구·근육세포를 파괴하고 광범위한 조직 괴사를 일으킨다',
          '아세틸콜린 방출을 차단한다',
          '단백질 합성을 방해한다',
          '혈장을 응고시킨다',
        ],
        answer: '세포막의 레시틴을 분해하여 적혈구·백혈구·근육세포를 파괴하고 광범위한 조직 괴사를 일으킨다',
      },
      {
        type: 'CHOICE',
        question_text: '가스괴저에서 균의 대사 과정 중 가스가 발생하여 피부를 누를 때 바스락거리는 소리가 나는 소견은?',
        options: ['염발음(Crepitus)', '후궁반장', '유황과립', '안전핀 모양'],
        answer: '염발음(Crepitus)',
      },
      {
        type: 'CHOICE',
        question_text: '방선균증(Actinomycosis) 진단의 핵심 소견으로, 화농 속에 관찰되는 1~2mm 노란 알갱이는?',
        options: ['유황과립(Sulfur granule)', 'Negri body', 'Koplik spot', 'Bubo'],
        answer: '유황과립(Sulfur granule)',
      },
      {
        type: 'CHOICE',
        question_text: '개·고양이의 구강 내 상재균으로 교상 상처를 통해 침입하며 협막으로 식균작용을 회피하는 균은?',
        options: ['Pasteurella multocida', 'Bartonella henselae', 'Streptobacillus moniliformis', 'Clostridium perfringens'],
        answer: 'Pasteurella multocida',
      },
      {
        type: 'CHOICE',
        question_text: '주로 어린 고양이가 보유하며 할퀴거나 물린 상처를 통해 침입해 국소 림프절 비대를 일으키는 묘소병의 병원체는?',
        options: ['Bartonella henselae', 'Pasteurella multocida', 'Francisella tularensis', 'Yersinia pestis'],
        answer: 'Bartonella henselae',
      },
      {
        type: 'OX',
        question_text:
          '사람에게 물린 상처(인간 교상)는 구강 내 다양한 호기성·혐기성 세균에 의한 복합 감염(Mixed infection) 양상을 띤다.',
        options: ['O', 'X'],
        answer: 'O',
      },
      {
        type: 'CHOICE',
        question_text: '장미 가시 등에 찔린 상처를 통해 감염되어 스포로트리쿰증을 일으키는 진균은?',
        options: ['Sporothrix schenckii', 'Candida albicans', 'Cryptococcus neoformans', 'Aspergillus'],
        answer: 'Sporothrix schenckii',
      },
      {
        type: 'SHORT',
        question_text:
          'MRSA(메티실린 내성 황색포도구균) 치료에 현재 사용되지만, 이 약마저 내성을 가진 균(VRSA)의 출현이 문제가 되는 항생제의 이름을 쓰시오.',
        options: [],
        answer: 'Vancomycin',
      },
    ],
  },

  {
    set: {
      id: 'set-micro-ch21',
      title: '미생물학 21장 - 혈관과 림프계 감염',
      description:
        '순환계 구조·비장 기능, 심내막염·균혈증·내독소쇼크, 야토병·브루셀라증·흑사병, 전염성 단핵구증·황열, 말라리아 등 혈관·림프계 감염 핵심 20문제.',
      tags: ['미생물학', '21장', '혈관림프계', '말라리아', '흑사병'],
      ...COMMON,
    },
    questions: [
      {
        type: 'CHOICE',
        question_text: '가장 큰 림프기관으로, 혈액을 저장·조절하고 노쇠한 적혈구·이물질을 탐식하는 기관은?',
        options: ['비장(Spleen)', '흉선(Thymus)', '편도선(Tonsils)', '간(Liver)'],
        answer: '비장(Spleen)',
      },
      {
        type: 'CHOICE',
        question_text: '동맥혈이 선홍색을 띠는 이유는?',
        options: ['산소와 혈색소(Hemoglobin)가 결합했기 때문', '이산화탄소가 많기 때문', '백혈구가 많기 때문', '혈소판이 많기 때문'],
        answer: '산소와 혈색소(Hemoglobin)가 결합했기 때문',
      },
      {
        type: 'CHOICE',
        question_text: '균혈증(Bacteremia)과 패혈증(Septicemia)의 차이로 옳은 것은?',
        options: [
          '패혈증은 혈액 내 세균 또는 독소로 인해 전신적인 질환이 생긴 경우이다',
          '균혈증은 반드시 사망에 이른다',
          '패혈증은 증상이 전혀 없는 상태이다',
          '둘은 완전히 같은 의미이다',
        ],
        answer: '패혈증은 혈액 내 세균 또는 독소로 인해 전신적인 질환이 생긴 경우이다',
      },
      {
        type: 'CHOICE',
        question_text: 'Gram 음성균이 생성하는 내독소에 의해 발열·과호흡·핍뇨와 함께 저혈압·쇼크로 사망에 이를 수 있는 상태는?',
        options: ['내독소 쇼크(Endotoxin Shock)', '아나필락시스', '심내막염', '균교대증'],
        answer: '내독소 쇼크(Endotoxin Shock)',
      },
      {
        type: 'CHOICE',
        question_text: '아급성 세균성 심내막염의 주요 원인균(전체의 약 90%)으로 옳은 것은?',
        options: [
          'α-용혈성 연쇄상구균과 표피포도구균',
          '대장균과 녹농균',
          '결핵균과 나균',
          '콜레라균과 이질균',
        ],
        answer: 'α-용혈성 연쇄상구균과 표피포도구균',
      },
      {
        type: 'CHOICE',
        question_text: '심내막염에서 균이 판막에 생필름(Biofilm)을 형성하는 것의 임상적 의미는?',
        options: ['식균작용을 어렵게 만든다', '독소 분비를 막는다', '항체 생성을 촉진한다', '혈류를 증가시킨다'],
        answer: '식균작용을 어렵게 만든다',
      },
      {
        type: 'CHOICE',
        question_text: '아급성 세균성 심내막염의 발병 위험이 높은 사람은?',
        options: [
          '선천성 심장 결함이 있거나 류마티스열로 판막이 손상된 사람',
          '키가 큰 사람',
          '운동을 많이 하는 사람',
          '혈압이 낮은 사람',
        ],
        answer: '선천성 심장 결함이 있거나 류마티스열로 판막이 손상된 사람',
      },
      {
        type: 'CHOICE',
        question_text: '토끼·다람쥐 등 야생동물이나 진드기를 통해 감염되는 인수공통감염증 야토병의 병원체는?',
        options: ['Francisella tularensis', 'Brucella melitensis', 'Yersinia pestis', 'Bartonella henselae'],
        answer: 'Francisella tularensis',
      },
      {
        type: 'CHOICE',
        question_text: '저온살균하지 않은 우유·유제품 섭취로 감염되며 불규칙한 발열(파상열)과 비장 팽대를 일으키는 인수공통감염증은?',
        options: ['파상열(브루셀라증, Brucella)', '야토병', '흑사병', '렙토스피라증'],
        answer: '파상열(브루셀라증, Brucella)',
      },
      {
        type: 'CHOICE',
        question_text: '흑사병(Plague)의 병원체는?',
        options: ['Yersinia pestis', 'Francisella tularensis', 'Brucella melitensis', 'Bartonella henselae'],
        answer: 'Yersinia pestis',
      },
      {
        type: 'CHOICE',
        question_text: '선페스트와 폐페스트의 차이로 옳은 것은?',
        options: [
          '폐페스트는 환자 비말을 통한 직접 감염으로 전염성이 강하고 치료하지 않으면 치사율이 100%에 근접한다',
          '폐페스트는 쥐벼룩으로만 전파된다',
          '선페스트가 폐페스트보다 전염성이 강하다',
          '둘 다 모기로 전파된다',
        ],
        answer: '폐페스트는 환자 비말을 통한 직접 감염으로 전염성이 강하고 치료하지 않으면 치사율이 100%에 근접한다',
      },
      {
        type: 'CHOICE',
        question_text: '페스트균(Yersinia pestis)을 양극 염색했을 때 나타나는 특징적 모양은?',
        options: ['안전핀(Safety-pin) 모양', '란셋형', '포도송이 모양', '나선 모양'],
        answer: '안전핀(Safety-pin) 모양',
      },
      {
        type: 'CHOICE',
        question_text: '페스트균의 협막항원(F1, Fra1)의 주요 기능은?',
        options: ['대식세포에 의한 식균작용을 회피', '적혈구를 용혈', '신경 전달을 차단', '혈장을 응고'],
        answer: '대식세포에 의한 식균작용을 회피',
      },
      {
        type: 'CHOICE',
        question_text: '주로 타액(침)을 통해 전파되어 "Kissing Disease"로 불리는 전염성 단핵구증의 병원체는?',
        options: ['Epstein-Barr virus(EBV)', 'Cytomegalovirus', 'HSV-1', 'HIV'],
        answer: 'Epstein-Barr virus(EBV)',
      },
      {
        type: 'CHOICE',
        question_text: '전염성 단핵구증에서 EBV가 직접 감염시키는 세포는?',
        options: ['B 림프구', '적혈구', '혈소판', '간세포'],
        answer: 'B 림프구',
      },
      {
        type: 'CHOICE',
        question_text: '전염성 단핵구증 혈액 도말에서 관찰되는 비정형 림프구(Atypical lymphocyte)의 정체는?',
        options: [
          'EBV에 감염된 B세포를 공격하기 위해 활성화된 세포독성 T세포',
          'EBV에 감염된 B세포 자체',
          '파괴된 적혈구',
          '비정상 혈소판',
        ],
        answer: 'EBV에 감염된 B세포를 공격하기 위해 활성화된 세포독성 T세포',
      },
      {
        type: 'CHOICE',
        question_text: '황열(Yellow Fever)을 매개하는 모기와 황달의 원인으로 옳은 것은?',
        options: [
          'Aedes aegypti(이집트숲모기)가 매개하며 간세포 파괴로 황달이 생긴다',
          '학질모기가 매개하며 적혈구 파괴로 황달이 생긴다',
          '작은빨간집모기가 매개하며 신장 손상으로 황달이 생긴다',
          '체체파리가 매개하며 비장 손상으로 황달이 생긴다',
        ],
        answer: 'Aedes aegypti(이집트숲모기)가 매개하며 간세포 파괴로 황달이 생긴다',
      },
      {
        type: 'CHOICE',
        question_text: '말라리아(Malaria)를 매개하는 곤충은?',
        options: ['암컷 학질모기(Anopheles)', '이집트숲모기(Aedes)', '체체파리(Glossina)', '쥐벼룩'],
        answer: '암컷 학질모기(Anopheles)',
      },
      {
        type: 'CHOICE',
        question_text: '말라리아에서 주기적인 열 발작이 나타나는 직접적인 원인은?',
        options: [
          '분열소체(Merozoite)가 적혈구를 파괴하며 방출되기 때문',
          '간세포가 황달을 일으키기 때문',
          '내독소가 유리되기 때문',
          '협막이 식균을 막기 때문',
        ],
        answer: '분열소체(Merozoite)가 적혈구를 파괴하며 방출되기 때문',
      },
      {
        type: 'OX',
        question_text: '낫모양적혈구증(겸상적혈구) 보유자는 말라리아에 상대적으로 안전하다.',
        options: ['O', 'X'],
        answer: 'O',
      },
    ],
  },
]

function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return

    const envFile = fs.readFileSync(envPath, 'utf8')
    for (const line of envFile.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (!match) continue

      const key = match[1].trim()
      let value = match[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    console.warn('Warning: Could not load .env.local manually.')
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  for (const { set, questions } of sets) {
    if (questions.length !== 20) {
      throw new Error(`${set.id} has ${questions.length} questions (expected 20)`)
    }

    console.log(`Seeding ${set.title}: ${set.id} (${questions.length} questions)`)

    const { error: setError } = await supabase
      .from('question_sets')
      .upsert(set, { onConflict: 'id' })

    if (setError) throw setError

    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .eq('set_id', set.id)

    if (deleteError) throw deleteError

    const { error: questionError } = await supabase.from('questions').insert(
      questions.map((question) => ({ set_id: set.id, ...question }))
    )

    if (questionError) throw questionError

    const { count, error: countError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', set.id)

    if (countError) throw countError

    console.log(`  → inserted ${count ?? 0} questions`)
  }

  console.log('Seed complete.')
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
