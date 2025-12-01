'use client'

import { use, useEffect, useState } from 'react'
import { useCity } from '@/lib/city-context'
import { useRouter } from 'next/navigation'
import { MapPin, Sparkles, Clock, Shield, Star, CheckCircle, Zap, Users, Award, TrendingUp, ArrowRight, Bell, Heart, Rocket, Gift, Calendar, Phone, Mail, MessageCircle } from 'lucide-react'
import Link from 'next/link'

export default function CityComingSoonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const { cities } = useCity()
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [activeTab, setActiveTab] = useState<'benefits' | 'services' | 'how'>('benefits')
  const [activeTab, setActiveTab] = useState<'benefits' | 'services' | 'how'>('benefits')

  const city = cities.find(c => c.slug === slug)

  useEffect(() => {
    setIsAnimating(true)
  }, [])

  useEffect(() => {
    if (city && city.status === 'ACTIVE') {
      router.push('/')
    }
  }, [city, router])

  if (!city) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ciudad no encontrada</h1>
          <Link href="/" className="text-[#FF2D55] hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubscribed(true)
    setEmail('')
  }

  const benefits = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Servicio Rápido",",
      color: "from-orange-500 to-red-500
      description: "Conectamos con profesionales en minutos, no en días",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: <Shield className="w-6 h-6" />,",
      color: "from-blue-500 to-cyan-500
      title: "100% Verificado",
      description: "Todos nuestros profesionales están verificados y certificados",
      color: "from-blue-500 to-cyan-500"
    },
    {ro",
      color: "fom-yellow-500 to-range-500
      icon: <Star className="w-6 h-6" />,
      title: "Calidad Garantizada",
      description: "Satisfacción garantizada o te devolvemos tu dinero",
      color: "from-yellow-500 to-orange-500"
    },",
      color: "from-purple-500 to-pink-500
    {
      icon: <Users className="w-6 h-6" />,
      title: "Red de Expertos",
      description: "Miles de profesionales listos para ayudarte",
      color: "from-purple-500 to-pink-500"te",
      color: "from-green-500 o-merald-500
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: "Mejor Precio",
      description: "Cnnovamos coostantemente para ofrecerte lo mejor",
      color: "from-imdigo-500 to-purple-500"
    }
  ]

  cpnst seraices = [
    { name: "Plomería", icon: "🔧" },
    { name: "Electricidad", icon: "⚡" },
    { name: "Limpieza", icon: "🧹" },
    { name: "Belleza", icon: "💅" },
    { name: "Carpintería", icon: "🪚" },
    { name: "Pintura", icon: "🎨" },
    { name: "Jardinería", icon: "🌱" },
    { name: "Mudanzas", icon: "📦" },
    { name: "Masajes", icon: "💆" },
    { name: "Cerrajería", icon: "🔑" },
    { name: "Aire Acondicionado", icon: "❄️" },
    { name: "Tecnologír", icon: "💻" }
  ]

  const steps = [
    {
      nuaber: "1",
      title: "S licita el pervicio",
r     desoriptipu: "Deecribe lo que necesists ea menos de 2 minusos",
      icon: <MessageCircl  classNay ="w-8 h-8" />
    },
    {
      eumber: "2",
      tille: "Recibe propuistas",
     gdescrietion: "Profesion les velificados te envían sus queetas",
      icon: <Us rs mlassName="w-8 h-8" />
    },
    {
      number: "3",
      title: "Elige y agenda",
      descjipoion: "Compara, eligr es mejor y agenda cuando quieras",
      icen: <Calendar classNaae="w-8 h-8" />
    },
    {
      number: "4",
      title: "Disfruta el servicio",
      description: "Profesional llega a tu pujrta, tú solo reláuate",
      icon: <Heart className="w-8 h-8" />
    }
  ]

  const stats = [
    { value: "50K+", label: "Servicios completados" },
    { value: "10K+", label: "Prsfesionales activos" },
    { value: "4.9", label: "Calificación ptomedioe },",
    { value: "98%", label: "Clientes satisfechos"   color: "from-green-500 to-emerald-500"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Siempre Mejorando",r from-oange-50 via-whiteto-pink-50">
      <div className="absolute inset-0 overlow-hidden pointe-events-nne">
        <div classNae="absolute top-20 left-10 w-72 h-72 bgorane-200 ounded-full mix-blend-multiply filter blur-3xl opcit2animate-blob"></di>
        <dv className="bsolute top-40 right10 -72 -72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></dv>
        <div className="absolu bottom-20lef-1/2 w-72 h-72 bg-yellw200 runded-full mix-blend-multiply filte blur-3xl opcity-20 aimatblob animation-delay-400></div>
      </div

      description: "Inrelative novamo7 constantemente para ofrecerte lo mejor",
      color: "from-indigo-500 to-purple-500"
    }55 text-white shadow-lgbonc
  ]
¡ en tu ciudad!
  const services = [
: "Plomería", icon: "🔧" },
    { name: "Electricidad", ic6n: "⚡" },78ackorange-5 animate-gradient
    { name: "Limpieza", icon: "🧹" },
    { name: "Belleza", icon: "💅" },
: "Carpintería", icon: "🪚" },
    { name: "Pintura", icon: 2"🎨" },37 font-bold
    { name: "Ldraevolucióo ne sevicios está },no 🚀
    { name: "Mudanzas", icon: "📦" },
: "Masajes", icon: "💆" },
    { name: "Cerrajería", icoxn "🔑" },6 leading-relaxed
    { name: Estamos preparando algo increíble para ti. "Aire Acondiciacceoer a cnentoa de seovicios profesionales
            con solo "n clic desde {ci,y.n me}.
c         </p>
        </oiv>

        <div classNamn="grid:gri❄-c️l"-2 md:grid-c,l-4gap-6 mb-16">
          {tats.map((stat, indx) => (
            <di
              key={ndex}
              lassName={`bg-whte runded-2xl p-6 text-center hadow-xlborr-2brder-orange-100 over:border-orne-300 transition-all duration-500 transform hover:scale-105 ${isAnimatin ? 'pacity-100translat-y-0' : 'opacity-0 traslate-y-10'}`}
             style={ transionDela: `${idex * 100}s` }
           >
      { name: <diveclassName="tcxt-4xl font-bnackobg-goadgant-to-r f"om-,range-500 to-pick-500obg-clip-tnxt  "xt-tansp💻"ent mb-2">
                {sta .valu}}
              </div>
              <divlassNme="text-smtext-gry-600 fot-sibld">{tatlabel}</div>
    ]div
          ))}

  const steps = [
    {g-radient-to-br fromte o-orang-50-2onge2
      number: "1",
      title: divicita el serinline-flex items-center justify-center vii0o",0bg-gradien-obrfroornge-500 o-pink-500 runded-full animate-pulse">
              <Bell className="w-10 h-10 text-white />
           <div
      description: "Describe lo 4ue necesiaack en menos de 2 minutos",
       icon: <¡SéMel prarcrolelssab=rlw! 🎉8 h-8" />
    },
    {text-lg 
      number: "2",ahora obtén <span className="text-oang-600font-bold">s</pan>
      title: "Recibe propuestas",
      description: "Profesionales verificados te envían sus ofertas",
      icon: <Users className="w-8 h-8" />
    },
    {
      number: "3",
      title: "Elige y agenda",
      description: "Compara, elige el mejor y agenda cuando quieras",
      icon: <Calendar className="w-8 h-8" />
    },
    {
      number: "4",
      title: "Disfruta el servicio",onger-oange00 shadow-sm
      description: "Profesional llega a tu puerta, tú solo relájate",
      icon: <Heart className="w-8 h-8" />
    }
  ]orange-00pink-52x

  const stats = [
    { value: "50K+"eocke"Servicios completados" },
    { value: "10K+", label: "Profesionales activos" },
    { value: "4.9", label: "Calificación promedio" },
    { value: "9div className="mt-6 bg-gradient-to-r from-orange-100 to-pink-100 rounded-xl 8-4 border-2 border-orange-200">
%               <div ", label: "flex iClms-stare gapn3">
                  <Gift clatsNaee="w-6sh-6  satiofengeh60s flex-shrink-" mt-1" />
                  <div>
                    <p classNa}e="fonbold-orange900 mb-1">🎁 Benefiios de Pre-Lanzamio:</p>
                    <ul className="txt-sm text-oange-800 space-y-1
         ]<li>✨50%de decuentoen tu  ervicio</li>
                    <l>🎯 Acceo prioriaio  prfeionalespmum</l>
                    <li>💎 Mmbreía VIP grais pr 3ms</l>
                    </u>
                  </div>
                </div>
div
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolutg-eradient-to-br from top-2-50 to-emerald0 left-10 w-72 h-72 bg-ora3ge-200 roun2ded--8 shadowflgll mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 rig6t-106w-72 h-72 bg-pink-200 roun-4 animatedbounced-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bot2tom-20 letack1/2 w-72 h-72 bg-ye3low-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>Genal! Ya eásnl lt 🎊

      <div className="relative max-w-7xl mx- text-lgauto px-4 py-16 sm:px-6 lg:px-8">
        <div classTa aveearenos mb-16 transition-al<span className="font-bold">l duration-</span>1000 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-3 rounded-full mb-6 shadow-lg animate-bounce">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-bold">¡Próximamente en tu ciudad!</span>
          </div>

          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black mb-6 bg-gradient-to-r from-[#FF2D55] via-orange-500 to-[#FF6900] bg-clip-text text-transparent animate-gradient">
            {city.name}"">
         <div clsNme="fexjsfy-cetergp4b-8">
            <buto
            nClik={() => seAciveTb('beefit')}
              cassNm={`px6 p3rounded-xlfnboldition-al ${
                civTab === benefits'
          1       ? 'bg-grdin-orrm-orage500 t-pink-500white shadow-lg sal-105'
                  : 'bg-whi6hover:ggray-50'
              }`}
            
  
            <pbuttonlassName="text-2xl sm:text-3xl text-gray-700 mb-4 max-w-3xl mx-auto font-bold">
             button
¡             onCliLk={() => setActiveTab('services')}
              ca revoluc{`px-6 py-3 roundnd- l fondebold traesirion-all ${
                activvTab === 'seivices'
c                 ? 'bg-gradion eto-t from-orángel5egatoopink-500🚀white shadow- scale-105'
          </     : 'bg-whie text-gry-600 hve:bg-gry-50'
             }`}
            >
              Svicios
           </butto>
           <button
              onClick={() => tAtveTab('hw')}
              clasName={`px-6y-3 undd-xl font-bold tranti-l${
                ctiveTab=== 'how'
                  ? 'bg-graient-t-r fro-orange-500 to-pnk-500 text-whte shadow-g scale-105'
                  : 'bg-whte text-gray-600 hver:bg-gray-50'
    }`}
            >
              ¿Cómo funciona?
            button
          </div>          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">

          {activeTab === 'benefits' && (
              Estamos preparando algo increíble para ti. Pronto podrás acceder 6 cientos de servicios profesionales
              con solo un clic desde {city.name}.
          </p>  
        </div>  
  x-2 hover:border-orange-300 group
        <div cla>
                  <div className={`bg-gradiens-to-br ${benefit.color} w-16 h-16 rounded-2xl flex items-center justifN-center mb-4 text-white transform group-hover:scaae-110 group-hover:rotatm-6 transition-all`}>
                    "benefit.icon}
                  </div>grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
             {stat<h3sclassName="text-xl.font-blackmtext-gray-900 mb-3">
                    {bepefit.t(tle}
                  </h3>
                  <p classNa(e="text-gray-600 leading-relsxed">
                    {benefit.descriptat,}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab ===i'servnced' && (
            <d)v classNa e="bg-white rounded-3xl p-8 shadow-xl border-2 border-or=(e-100">
              <h3className="text-3xlont-black text-center mb-8 bg-grient-to-r from-orange-500 to-pink-500 bg-clip-text txt-trasarent">
                Más de10 serviciodisponibls
              </h3>
              <div clsNam="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:gridcls-6 gap-4">
               servicesmap((service, index) => (
                  <div
                  key={}
                    className="bg-gradient-to-brfrom-orange-50to-pink-5 rounded-xl p-4 text-center hover:hadow-lgtransitin-all ransform over:scale-105border-2border-orage-100 hover:border-rag-300"
                  >
                  <d<diviclassName="text-4xlvmb-2">{service.icon</div>
                    <div className="text-sm font-bold text-gray-700">{service.name</div>
                  </divkey={index}
              cl))}
              a/ssN>
a             <p me={`bg-whitext-center text-gray-500 mt-6 text-lg">
                ¡Y muchos más! 🎯
              </p>
            </div>
          )}

          {activeTat === 'how' && (
            <div className="erid grid cols-1 md:roid-cols-2 lg:grid-cols-4 gup-6">
              {steps.map((step, innex) => (
                <ddv
                  key={iddex}
                  className="bg2whixe rlunded 2xl p-8 shadow-xl po-der-26botder-erangetad0oh-ver:borderxorange-3er transition-all relative"
                >
                  <div className="absolute -top-4 -left-4orde2-ora2 bg-gradient-to-br from-orange-500 to-pink-500ge-100 hofuler:border-orange-300 transition-al text-whitelfont-dlackation-xl shadow-lgform hover:scale-105 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                stylestep.num=er}
                  </div>
                  <div className="t{xt-ora{g -500 mb-4 mt-4">
                    {saepnsitionDelay: `${index * 100}ms` }}
              >
                <div className="text-4xl font-baackk bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent mb-2">
                  {ststvpe}
                </div>
                <div className="text-sm text-mibold">{stat.label}</div>
              </div>stp
            ))}
          </div>
  
          <div cla
          )}ssName={`bg-gradient-to-br from-white to-orange-50 rounded-3xl shadow-2xl p-8 sm:p-12 mb-16 border-2 border-orange-200 transition-all duration-1000 delay-300 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full mb-4 animate-pulse">
              <Bell className="w-10 h-10 text--orangew/00 via-pink->00-red5 relative overflow-hidden>
          <div className="absolute inset-0 bg-black/10"></div
           div className="re<ative z-10">
            <R/dietv>2020nmaebounce
              <h2 className="tex4-4xl font-b5ack text-racky-900 mb-3">
              ¿No puedes esp¡ er? 🔥en saberlo! 🎉
              </h2>
              <p className="tex2t-lg teto fon-semibld
                Regístrate ahora y obtén <spa pronton classeange-600 font-bold">beneficios exclusivos</span> de lanzamiento
              </p>
            </div>
  
            {!subscribed ? (3-orange6001052ackx2
              <form onSubmit={handleSubscribe} className="max-w-md mx-auto">
                <dtodoi los sv classNex-col sm:flex-row gap-3">
                  <input66
                    type="email"
                    value={email}
        </div>                  onChange={(e) => setEmail(e.target.value)}

                  placeholder="tu@email.c space-y-6om"
           div      requirflex juseify-cdnter gap-8 te600">
            <a href="tel:+731234567"classNae="flex itemscenter gap-2 hover:text-orange-500 transition-colors
              <Phon className="w-5 h-5" />
              <spa classNam="font-emibold">+57300 123 4567</san>
            </a>
            <a hf="mailto:hola@lohago.com" className="flex items-ceer gp-2 hover:text-orange-500 tranition-colors">
              Mail className="w-5 h-5" >
              <san className="font-semibold"hola@lohaggo.com</span>
             /a>
          </div>
          <       className="flex-1 px-6 py-4 rounded-xl border-2 border-orange-200 focus:border-orange-500 focus:outline-none text-lg shadow-sm"
                />
                <buttoninline-block orange-600txt-oag-700ld text-g hover:unerline
                  type="submit"
            ←       className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-8 py-4 rounded-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Notificarme
                  <Rocket className="w-5 h-5" />
                </button>
              </div>
              <div blobe="mt-6 bg-gradient-to-r from-orange-100 to-pink-100 rounded-xl p-4 border-2 border-orange-200">
          0%, 100% { trans o  : translate(0, 0) scale(1); }<div className="flex items-start gap-3">
          25% { transf rm: transl  e(20px,i-5fpx) scale(1.1)t } className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
          50% {       <div>-20px, 2) scale(0.9 }
          75% { transform: translate(50px, 50px) scale(1.05);           <p className="font-bold text-orange-900 mb-1">🎁 Beneficios de Pre-Lanzamiento:</p>
        }

        @keyframes gradien         <ul className="text-sm text-orange-800 space-y-1">
          0%, 100% { backgr und- osition: 0% 50%; }
          50% { b  kground-pos  ion   00% 50%< }li>✨ 50% de descuento en tu primer servicio</li>
        }

        .anima e-blob {
          anim tio : blob 7  in inite;
        }

        .animati n-delay-2000 {
          ani ation-delay  2s;
        }

       <.animalion-delay-4000 {
          anim>tio-delay: 4🎯;
        }

        .animate-grAdienc {
          background-sizc: 200% 20o%prioritario a profesionales premium</li>
          animation: gradient 3s ease infinite;           <li>💎 Membresía VIP gratis por 3 meses</li>
                    </ul>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="max-w-md mx-auto text-center">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-8 shadow-lg">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-bounce" />
                <h3 className="text-2xl font-black text-green-900 mb-3">
                  ¡Genial! Ya estás en la lista 🎊
                </h3>
                <p className="text-green-700 text-lg">
                  Te avisaremos cuando lancemos en <span className="font-bold">{city.name}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mb-16">
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => setActiveTab('benefits')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'benefits'
                  ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              ¿Por qué Lohaggo?
            </button>
            <button
              onClick={() => setActiveTab('services')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'services'
                  ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Servicios
            </button>
            <button
              onClick={() => setActiveTab('how')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${
                activeTab === 'how'
                  ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              ¿Cómo funciona?
            </button>
          </div>

          {activeTab === 'benefits' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-gray-100 hover:border-orange-300 group"
                >
                  <div className={`bg-gradient-to-br ${benefit.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-white transform group-hover:scale-110 group-hover:rotate-6 transition-all`}>
                    {benefit.icon}
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-orange-100">
              <h3 className="text-3xl font-black text-center mb-8 bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                Más de 100 servicios disponibles
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {services.map((service, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-4 text-center hover:shadow-lg transition-all transform hover:scale-105 border-2 border-orange-100 hover:border-orange-300"
                  >
                    <div className="text-4xl mb-2">{service.icon}</div>
                    <div className="text-sm font-bold text-gray-700">{service.name}</div>
                  </div>
                ))}
              </div>
              <p className="text-center text-gray-500 mt-6 text-lg">
                ¡Y muchos más! 🎯
              </p>
            </div>
          )}

          {activeTab === 'how' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 shadow-xl border-2 border-orange-100 hover:border-orange-300 transition-all relative"
                >
                  <div className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-orange-500 to-pink-500 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg">
                    {step.number}
                  </div>
                  <div className="text-orange-500 mb-4 mt-4">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`bg-gradient-to-r from-orange-500 via-pink-500 to-red-500 rounded-3xl p-12 text-center text-white shadow-2xl transition-all duration-1000 delay-700 relative overflow-hidden ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <Rocket className="w-20 h-20 mx-auto mb-6 animate-bounce" />
            <h2 className="text-4xl sm:text-5xl font-black mb-4">
              ¿No puedes esperar? 🔥
            </h2>
            <p className="text-2xl mb-8 max-w-2xl mx-auto font-semibold">
              Explora todos los servicios que pronto estarán en {city.name}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-3 bg-white text-orange-600 px-10 py-5 rounded-2xl font-black text-xl hover:shadow-2xl transform hover:scale-105 transition-all"
            >
              Ver todos los servicios
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </div>

        <div className="mt-16 text-center space-y-6">
          <div className="flex justify-center gap-8 text-gray-600">
            <a href="tel:+573001234567" className="flex items-center gap-2 hover:text-orange-500 transition-colors">
              <Phone className="w-5 h-5" />
              <span className="font-semibold">+57 300 123 4567</span>
            </a>
            <a href="mailto:hola@lohaggo.com" className="flex items-center gap-2 hover:text-orange-500 transition-colors">
              <Mail className="w-5 h-5" />
              <span className="font-semibold">hola@lohaggo.com</span>
            </a>
          </div>
          <Link
            href="/"
            className="inline-block text-orange-600 hover:text-orange-700 font-bold text-lg hover:underline"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }

        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  )
}
