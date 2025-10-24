'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function PoliticaPrivacidade() {
  // Estado para idioma selecionado
  const [selectedLanguage, setSelectedLanguage] = useState<'pt' | 'en' | 'es' | 'fr'>(() => {
    try {
      const stored = localStorage.getItem('selectedLanguage');
      if (stored === 'en' || stored === 'es' || stored === 'fr' || stored === 'pt') return stored;
    } catch {}
    return 'pt';
  });

  // Função para obter textos de interface baseados no idioma
  function getInterfaceTexts() {
    const texts = {
      'pt': {
        title: 'Política de Privacidade – Virtual Sommelier',
        intro1: 'O Virtual Sommelier é propriedade da empresa Inovpartner. A Inovpartner é uma empresa de tecnologia da informação e inteligência artificial, com sede em Rua Álvaro Pires Miranda, nº 270-B, 2415-369 Marrazes, Leiria, Portugal, NIF 514877731, compromete-se a proteger a privacidade dos utilizadores do seu website e a garantir a confidencialidade dos dados pessoais recolhidos.',
        intro2: 'Esta Política de Privacidade explica como recolhemos, utilizamos, armazenamos e protegemos os dados pessoais dos utilizadores, em conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD) e demais legislação aplicável.',
        section1Title: '1. Dados recolhidos',
        section1Text: 'Podemos recolher as seguintes categorias de dados:',
        section1Item1: 'Dados fornecidos pelo utilizador: informações partilhadas em formulários de contacto ou outros meios de comunicação.',
        section1Item2: 'Dados técnicos: endereço IP, tipo de dispositivo, navegador, sistema operativo, cookies e dados de utilização do site.',
        section1Item3: 'Dados derivados da utilização do website: interações com páginas e conteúdos e preferências de utilização.',
        section1Item4: 'Dados de conversação: mensagens trocadas com o chatbot virtual para melhorar a experiência e responder às suas perguntas.',
        section2Title: '2. Finalidade do tratamento',
        section2Text: 'Os dados pessoais são utilizados para:',
        section2Item1: 'Assegurar o funcionamento e melhoria contínua da plataforma.',
        section2Item2: 'Responder a pedidos de informação e prestar apoio aos utilizadores.',
        section2Item3: 'Melhorar os nossos serviços e a experiência de utilização.',
        section2Item4: 'Processar e responder às suas perguntas através do chatbot virtual.',
        section2Item5: 'Cumprir obrigações legais ou regulamentares.',
        section3Title: '3. Base legal do tratamento',
        section3Text: 'O tratamento dos dados é realizado com base em:',
        section3Item1: 'Consentimento do utilizador.',
        section3Item2: 'Execução de contrato ou prestação de serviços.',
        section3Item3: 'Interesse legítimo da Virtual Sommelier (por ex.: segurança da plataforma, prevenção de abusos).',
        section4Title: '4. Partilha de dados',
        section4Text: 'Os dados podem ser partilhados com:',
        section4Item1: 'Prestadores de serviços tecnológicos (ex.: alojamento, fornecedores de API de IA).',
        section4Item2: 'Autoridades competentes, sempre que exigido por lei.',
        section4Text2: 'Garantimos que os terceiros cumprem o RGPD e que os dados são tratados apenas para os fins acordados.',
        section5Title: '5. Conservação dos dados',
        section5Item1: 'Os dados de utilização do website poderão ser armazenados por um período limitado, apenas para efeitos de melhoria dos serviços.',
        section5Item2: 'As conversações com o chatbot são armazenadas temporariamente para melhorar a qualidade das respostas.',
        section5Item3: 'Após esse período, os dados serão eliminados ou anonimizados.',
        section5Item4: 'O tempo de retenção pode variar conforme obrigações legais específicas.',
        section6Title: '6. Segurança dos dados',
        section6Text: 'Adotamos medidas técnicas e organizativas adequadas para proteger os dados pessoais contra acesso não autorizado, perda, alteração ou divulgação indevida.',
        section6WarningTitle: '⚠️ Aviso importante sobre o chatbot:',
        section6WarningText: 'Contudo, alertamos os utilizadores para não partilharem informações sensíveis (como dados de saúde, financeiros ou identificativos oficiais) no chatbot. O chatbot é uma ferramenta de apoio e não deve ser utilizado para partilhar informações confidenciais ou pessoais sensíveis.',
        section7Title: '7. Direitos dos titulares',
        section7Text: 'Nos termos da lei, os utilizadores têm direito a:',
        section7Item1: 'Aceder aos seus dados pessoais.',
        section7Item2: 'Corrigir dados incorretos ou desatualizados.',
        section7Item3: 'Solicitar a eliminação dos dados.',
        section7Item4: 'Limitar ou opor-se ao tratamento.',
        section7Item5: 'Solicitar a portabilidade dos dados.',
        section7Text2: 'Para exercer estes direitos, o utilizador pode contactar-nos através de',
        section7Text3: 'ou pelo telefone',
        section8Title: '8. Cookies e tecnologias semelhantes',
        section8Text: 'O nosso website pode utilizar cookies para:',
        section8Item1: 'Garantir o correto funcionamento da plataforma.',
        section8Item2: 'Melhorar a navegação e experiência do utilizador.',
        section8Item3: 'Analisar estatísticas de utilização.',
        section8Text2: 'O utilizador pode gerir as suas preferências de cookies através das definições do navegador.',
        section9Title: '9. Alterações à Política de Privacidade',
        section9Text: 'A Inov Partner reserva-se o direito de atualizar esta Política de Privacidade sempre que necessário. As alterações serão comunicadas através do website.',
        section10Title: '10. Contactos',
        contactCompany: 'Inovpartner',
        contactAddress1: 'Rua Álvaro Pires Miranda, nº 270-B',
        contactAddress2: '2415-369 Marrazes – Leiria – Portugal',
        contactNif: 'NIF: 514877731',
        backButton: '← Voltar ao Virtual Sommelier',
        complaintsBook: 'Livro de Reclamações',
        privacyPolicy: 'Política de Privacidade',
        copyright: '© Inov Partner Todos os direitos reservados.'
      },
      'en': {
        title: 'Privacy Policy – Virtual Sommelier',
        intro1: 'Virtual Sommelier is owned by Inovpartner. Inovpartner is an information technology and artificial intelligence company, headquartered at Rua Álvaro Pires Miranda, nº 270-B, 2415-369 Marrazes, Leiria, Portugal, NIF 514877731, is committed to protecting the privacy of users of its website and ensuring the confidentiality of personal data collected.',
        intro2: 'This Privacy Policy explains how we collect, use, store and protect users\' personal data, in compliance with the General Data Protection Regulation (GDPR) and other applicable legislation.',
        section1Title: '1. Data collected',
        section1Text: 'We may collect the following categories of data:',
        section1Item1: 'Data provided by the user: information shared in contact forms or other means of communication.',
        section1Item2: 'Technical data: IP address, device type, browser, operating system, cookies and website usage data.',
        section1Item3: 'Data derived from website usage: interactions with pages and content and usage preferences.',
        section1Item4: 'Conversation data: messages exchanged with the virtual chatbot to improve the experience and answer your questions.',
        section2Title: '2. Purpose of processing',
        section2Text: 'Personal data is used to:',
        section2Item1: 'Ensure the operation and continuous improvement of the platform.',
        section2Item2: 'Respond to information requests and provide user support.',
        section2Item3: 'Improve our services and user experience.',
        section2Item4: 'Process and answer your questions through the virtual chatbot.',
        section2Item5: 'Comply with legal or regulatory obligations.',
        section3Title: '3. Legal basis for processing',
        section3Text: 'Data processing is carried out based on:',
        section3Item1: 'User consent.',
        section3Item2: 'Contract execution or service provision.',
        section3Item3: 'Legitimate interest of Virtual Sommelier (e.g.: platform security, abuse prevention).',
        section4Title: '4. Data sharing',
        section4Text: 'Data may be shared with:',
        section4Item1: 'Technology service providers (e.g.: hosting, AI API providers).',
        section4Item2: 'Competent authorities, whenever required by law.',
        section4Text2: 'We ensure that third parties comply with GDPR and that data is processed only for agreed purposes.',
        section5Title: '5. Data retention',
        section5Item1: 'Website usage data may be stored for a limited period, only for service improvement purposes.',
        section5Item2: 'Chatbot conversations are temporarily stored to improve response quality.',
        section5Item3: 'After this period, data will be deleted or anonymized.',
        section5Item4: 'Retention time may vary according to specific legal obligations.',
        section6Title: '6. Data security',
        section6Text: 'We adopt appropriate technical and organizational measures to protect personal data against unauthorized access, loss, alteration or improper disclosure.',
        section6WarningTitle: '⚠️ Important notice about the chatbot:',
        section6WarningText: 'However, we warn users not to share sensitive information (such as health, financial or official identification data) in the chatbot. The chatbot is a support tool and should not be used to share confidential or sensitive personal information.',
        section7Title: '7. Data subject rights',
        section7Text: 'Under the law, users have the right to:',
        section7Item1: 'Access their personal data.',
        section7Item2: 'Correct incorrect or outdated data.',
        section7Item3: 'Request data deletion.',
        section7Item4: 'Limit or object to processing.',
        section7Item5: 'Request data portability.',
        section7Text2: 'To exercise these rights, the user can contact us at',
        section7Text3: 'or by phone',
        section8Title: '8. Cookies and similar technologies',
        section8Text: 'Our website may use cookies to:',
        section8Item1: 'Ensure proper platform operation.',
        section8Item2: 'Improve navigation and user experience.',
        section8Item3: 'Analyze usage statistics.',
        section8Text2: 'Users can manage their cookie preferences through browser settings.',
        section9Title: '9. Changes to Privacy Policy',
        section9Text: 'Inov Partner reserves the right to update this Privacy Policy whenever necessary. Changes will be communicated through the website.',
        section10Title: '10. Contacts',
        contactCompany: 'Inovpartner',
        contactAddress1: 'Rua Álvaro Pires Miranda, nº 270-B',
        contactAddress2: '2415-369 Marrazes – Leiria – Portugal',
        contactNif: 'NIF: 514877731',
        backButton: '← Back to Virtual Sommelier',
        complaintsBook: 'Complaints Book',
        privacyPolicy: 'Privacy Policy',
        copyright: '© Inov Partner All rights reserved.'
      },
      'es': {
        title: 'Política de Privacidad – Virtual Sommelier',
        intro1: 'Virtual Sommelier es propiedad de Inovpartner. Inovpartner es una empresa de tecnología de la información e inteligencia artificial, con sede en Rua Álvaro Pires Miranda, nº 270-B, 2415-369 Marrazes, Leiria, Portugal, NIF 514877731, se compromete a proteger la privacidad de los usuarios de su sitio web y garantizar la confidencialidad de los datos personales recopilados.',
        intro2: 'Esta Política de Privacidad explica cómo recopilamos, utilizamos, almacenamos y protegemos los datos personales de los usuarios, en cumplimiento del Reglamento General de Protección de Datos (RGPD) y demás legislación aplicable.',
        section1Title: '1. Datos recopilados',
        section1Text: 'Podemos recopilar las siguientes categorías de datos:',
        section1Item1: 'Datos proporcionados por el usuario: información compartida en formularios de contacto u otros medios de comunicación.',
        section1Item2: 'Datos técnicos: dirección IP, tipo de dispositivo, navegador, sistema operativo, cookies y datos de uso del sitio web.',
        section1Item3: 'Datos derivados del uso del sitio web: interacciones con páginas y contenido y preferencias de uso.',
        section1Item4: 'Datos de conversación: mensajes intercambiados con el chatbot virtual para mejorar la experiencia y responder a sus preguntas.',
        section2Title: '2. Finalidad del tratamiento',
        section2Text: 'Los datos personales se utilizan para:',
        section2Item1: 'Asegurar el funcionamiento y mejora continua de la plataforma.',
        section2Item2: 'Responder a solicitudes de información y brindar apoyo a los usuarios.',
        section2Item3: 'Mejorar nuestros servicios y la experiencia de usuario.',
        section2Item4: 'Procesar y responder a sus preguntas a través del chatbot virtual.',
        section2Item5: 'Cumplir con obligaciones legales o regulatorias.',
        section3Title: '3. Base legal del tratamiento',
        section3Text: 'El tratamiento de datos se realiza con base en:',
        section3Item1: 'Consentimiento del usuario.',
        section3Item2: 'Ejecución de contrato o prestación de servicios.',
        section3Item3: 'Interés legítimo de Virtual Sommelier (ej.: seguridad de la plataforma, prevención de abusos).',
        section4Title: '4. Compartir datos',
        section4Text: 'Los datos pueden ser compartidos con:',
        section4Item1: 'Proveedores de servicios tecnológicos (ej.: hosting, proveedores de API de IA).',
        section4Item2: 'Autoridades competentes, siempre que sea exigido por ley.',
        section4Text2: 'Garantizamos que los terceros cumplen con el RGPD y que los datos se procesan solo para los fines acordados.',
        section5Title: '5. Conservación de datos',
        section5Item1: 'Los datos de uso del sitio web pueden ser almacenados por un período limitado, solo para efectos de mejora de los servicios.',
        section5Item2: 'Las conversaciones con el chatbot se almacenan temporalmente para mejorar la calidad de las respuestas.',
        section5Item3: 'Después de ese período, los datos serán eliminados o anonimizados.',
        section5Item4: 'El tiempo de retención puede variar según obligaciones legales específicas.',
        section6Title: '6. Seguridad de datos',
        section6Text: 'Adoptamos medidas técnicas y organizativas adecuadas para proteger los datos personales contra acceso no autorizado, pérdida, alteración o divulgación indebida.',
        section6WarningTitle: '⚠️ Aviso importante sobre el chatbot:',
        section6WarningText: 'Sin embargo, advertimos a los usuarios que no compartan información sensible (como datos de salud, financieros o de identificación oficial) en el chatbot. El chatbot es una herramienta de apoyo y no debe ser utilizado para compartir información confidencial o personal sensible.',
        section7Title: '7. Derechos de los titulares',
        section7Text: 'En términos de la ley, los usuarios tienen derecho a:',
        section7Item1: 'Acceder a sus datos personales.',
        section7Item2: 'Corregir datos incorrectos o desactualizados.',
        section7Item3: 'Solicitar la eliminación de datos.',
        section7Item4: 'Limitar u oponerse al tratamiento.',
        section7Item5: 'Solicitar la portabilidad de datos.',
        section7Text2: 'Para ejercer estos derechos, el usuario puede contactarnos a través de',
        section7Text3: 'o por teléfono',
        section8Title: '8. Cookies y tecnologías similares',
        section8Text: 'Nuestro sitio web puede utilizar cookies para:',
        section8Item1: 'Garantizar el correcto funcionamiento de la plataforma.',
        section8Item2: 'Mejorar la navegación y experiencia del usuario.',
        section8Item3: 'Analizar estadísticas de uso.',
        section8Text2: 'El usuario puede gestionar sus preferencias de cookies a través de la configuración del navegador.',
        section9Title: '9. Cambios en la Política de Privacidad',
        section9Text: 'Inov Partner se reserva el derecho de actualizar esta Política de Privacidad siempre que sea necesario. Los cambios serán comunicados a través del sitio web.',
        section10Title: '10. Contactos',
        contactCompany: 'Inovpartner',
        contactAddress1: 'Rua Álvaro Pires Miranda, nº 270-B',
        contactAddress2: '2415-369 Marrazes – Leiria – Portugal',
        contactNif: 'NIF: 514877731',
        backButton: '← Volver a Virtual Sommelier',
        complaintsBook: 'Libro de Reclamaciones',
        privacyPolicy: 'Política de Privacidad',
        copyright: '© Inov Partner Todos los derechos reservados.'
      },
      'fr': {
        title: 'Politique de Confidentialité – Virtual Sommelier',
        intro1: 'Virtual Sommelier appartient à Inovpartner. Inovpartner est une entreprise de technologie de l\'information et d\'intelligence artificielle, basée à Rua Álvaro Pires Miranda, nº 270-B, 2415-369 Marrazes, Leiria, Portugal, NIF 514877731, s\'engage à protéger la vie privée des utilisateurs de son site web et à garantir la confidentialité des données personnelles collectées.',
        intro2: 'Cette Politique de Confidentialité explique comment nous collectons, utilisons, stockons et protégeons les données personnelles des utilisateurs, en conformité avec le Règlement Général sur la Protection des Données (RGPD) et autres législations applicables.',
        section1Title: '1. Données collectées',
        section1Text: 'Nous pouvons collecter les catégories de données suivantes :',
        section1Item1: 'Données fournies par l\'utilisateur : informations partagées dans des formulaires de contact ou autres moyens de communication.',
        section1Item2: 'Données techniques : adresse IP, type d\'appareil, navigateur, système d\'exploitation, cookies et données d\'utilisation du site.',
        section1Item3: 'Données dérivées de l\'utilisation du site web : interactions avec les pages et le contenu et préférences d\'utilisation.',
        section1Item4: 'Données de conversation : messages échangés avec le chatbot virtuel pour améliorer l\'expérience et répondre à vos questions.',
        section2Title: '2. Finalité du traitement',
        section2Text: 'Les données personnelles sont utilisées pour :',
        section2Item1: 'Assurer le fonctionnement et l\'amélioration continue de la plateforme.',
        section2Item2: 'Répondre aux demandes d\'information et fournir un support aux utilisateurs.',
        section2Item3: 'Améliorer nos services et l\'expérience utilisateur.',
        section2Item4: 'Traiter et répondre à vos questions via le chatbot virtuel.',
        section2Item5: 'Respecter les obligations légales ou réglementaires.',
        section3Title: '3. Base légale du traitement',
        section3Text: 'Le traitement des données est effectué sur la base de :',
        section3Item1: 'Le consentement de l\'utilisateur.',
        section3Item2: 'L\'exécution de contrat ou la prestation de services.',
        section3Item3: 'L\'intérêt légitime de Virtual Sommelier (ex. : sécurité de la plateforme, prévention des abus).',
        section4Title: '4. Partage de données',
        section4Text: 'Les données peuvent être partagées avec :',
        section4Item1: 'Des prestataires de services technologiques (ex. : hébergement, fournisseurs d\'API d\'IA).',
        section4Item2: 'Les autorités compétentes, chaque fois que requis par la loi.',
        section4Text2: 'Nous garantissons que les tiers respectent le RGPD et que les données sont traitées uniquement aux fins convenues.',
        section5Title: '5. Conservation des données',
        section5Item1: 'Les données d\'utilisation du site web peuvent être stockées pour une période limitée, uniquement à des fins d\'amélioration des services.',
        section5Item2: 'Les conversations avec le chatbot sont stockées temporairement pour améliorer la qualité des réponses.',
        section5Item3: 'Après cette période, les données seront supprimées ou anonymisées.',
        section5Item4: 'Le temps de rétention peut varier selon les obligations légales spécifiques.',
        section6Title: '6. Sécurité des données',
        section6Text: 'Nous adoptons des mesures techniques et organisationnelles appropriées pour protéger les données personnelles contre l\'accès non autorisé, la perte, l\'altération ou la divulgation inappropriée.',
        section6WarningTitle: '⚠️ Avertissement important concernant le chatbot :',
        section6WarningText: 'Cependant, nous avertissons les utilisateurs de ne pas partager d\'informations sensibles (comme les données de santé, financières ou d\'identification officielle) dans le chatbot. Le chatbot est un outil de support et ne doit pas être utilisé pour partager des informations confidentielles ou personnelles sensibles.',
        section7Title: '7. Droits des titulaires',
        section7Text: 'En vertu de la loi, les utilisateurs ont le droit de :',
        section7Item1: 'Accéder à leurs données personnelles.',
        section7Item2: 'Corriger les données incorrectes ou obsolètes.',
        section7Item3: 'Demander la suppression des données.',
        section7Item4: 'Limiter ou s\'opposer au traitement.',
        section7Item5: 'Demander la portabilité des données.',
        section7Text2: 'Pour exercer ces droits, l\'utilisateur peut nous contacter via',
        section7Text3: 'ou par téléphone',
        section8Title: '8. Cookies et technologies similaires',
        section8Text: 'Notre site web peut utiliser des cookies pour :',
        section8Item1: 'Garantir le bon fonctionnement de la plateforme.',
        section8Item2: 'Améliorer la navigation et l\'expérience utilisateur.',
        section8Item3: 'Analyser les statistiques d\'utilisation.',
        section8Text2: 'L\'utilisateur peut gérer ses préférences de cookies via les paramètres du navigateur.',
        section9Title: '9. Modifications de la Politique de Confidentialité',
        section9Text: 'Inov Partner se réserve le droit de mettre à jour cette Politique de Confidentialité chaque fois que nécessaire. Les modifications seront communiquées via le site web.',
        section10Title: '10. Contacts',
        contactCompany: 'Inovpartner',
        contactAddress1: 'Rua Álvaro Pires Miranda, nº 270-B',
        contactAddress2: '2415-369 Marrazes – Leiria – Portugal',
        contactNif: 'NIF: 514877731',
        backButton: '← Retour à Virtual Sommelier',
        complaintsBook: 'Livre de Réclamations',
        privacyPolicy: 'Politique de Confidentialité',
        copyright: '© Inov Partner Tous droits réservés.'
      }
    };
    return texts[selectedLanguage] || texts['pt'];
  }

  const texts = getInterfaceTexts();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>{texts.title}</h1>
        
        <div className={styles.intro}>
          <p>
            {texts.intro1}
          </p>
          <p>
            {texts.intro2}
          </p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section1Title}</h2>
          <p>{texts.section1Text}</p>
          <ul className={styles.list}>
            <li><strong>{texts.section1Item1}</strong></li>
            <li><strong>{texts.section1Item2}</strong></li>
            <li><strong>{texts.section1Item3}</strong></li>
            <li><strong>{texts.section1Item4}</strong></li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section2Title}</h2>
          <p>{texts.section2Text}</p>
          <ul className={styles.list}>
            <li>{texts.section2Item1}</li>
            <li>{texts.section2Item2}</li>
            <li>{texts.section2Item3}</li>
            <li>{texts.section2Item4}</li>
            <li>{texts.section2Item5}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section3Title}</h2>
          <p>{texts.section3Text}</p>
          <ul className={styles.list}>
            <li>{texts.section3Item1}</li>
            <li>{texts.section3Item2}</li>
            <li>{texts.section3Item3}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section4Title}</h2>
          <p>{texts.section4Text}</p>
          <ul className={styles.list}>
            <li>{texts.section4Item1}</li>
            <li>{texts.section4Item2}</li>
          </ul>
          <p>{texts.section4Text2}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section5Title}</h2>
          <ul className={styles.list}>
            <li>{texts.section5Item1}</li>
            <li>{texts.section5Item2}</li>
            <li>{texts.section5Item3}</li>
            <li>{texts.section5Item4}</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section6Title}</h2>
          <p>{texts.section6Text}</p>
          <div className={styles.warning}>
            <p><strong>{texts.section6WarningTitle}</strong></p>
            <p>{texts.section6WarningText}</p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section7Title}</h2>
          <p>{texts.section7Text}</p>
          <ul className={styles.list}>
            <li>{texts.section7Item1}</li>
            <li>{texts.section7Item2}</li>
            <li>{texts.section7Item3}</li>
            <li>{texts.section7Item4}</li>
            <li>{texts.section7Item5}</li>
          </ul>
          <p>{texts.section7Text2} <a href="mailto:geral@virtualsommelier.info" className={styles.link}>geral@virtualsommelier.info</a> {texts.section7Text3} <a href="tel:+351915700200" className={styles.link}>+351 915 700 200</a>.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section8Title}</h2>
          <p>{texts.section8Text}</p>
          <ul className={styles.list}>
            <li>{texts.section8Item1}</li>
            <li>{texts.section8Item2}</li>
            <li>{texts.section8Item3}</li>
          </ul>
          <p>{texts.section8Text2}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section9Title}</h2>
          <p>{texts.section9Text}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{texts.section10Title}</h2>
          <div className={styles.contactInfo}>
            <p><strong>{texts.contactCompany}</strong></p>
            <p>{texts.contactAddress1}</p>
            <p>{texts.contactAddress2}</p>
            <p><a href="mailto:geral@virtualsommelier.info" className={styles.link}>geral@virtualsommelier.info</a></p>
            <p><a href="tel:+351915700200" className={styles.link}>+351 915 700 200</a></p>
            <p>{texts.contactNif}</p>
          </div>
        </section>

        <div className={styles.backButton}>
          <a href="/" className={styles.backLink}>{texts.backButton}</a>
        </div>
      </div>
      
      {/* Footer com copyright */}
      <footer style={{
        background: 'rgba(0, 0, 0, 0.95)',
        padding: '16px 0',
        textAlign: 'center',
        fontSize: '14px',
        color: '#666',
        marginTop: '40px',
        borderTop: '1px solid rgba(0,0,0,0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <a
            href="https://www.livroreclamacoes.pt/Inicio/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'white', textDecoration: 'none' }}
          >
            {texts.complaintsBook}
          </a>
          <span style={{ color: '#666' }}>|</span>
          <a
            href="/politica-privacidade"
            style={{ color: 'white', textDecoration: 'none' }}
          >
            {texts.privacyPolicy}
          </a>
        </div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          © {new Date().getFullYear()} {texts.copyright}
        </div>
      </footer>
    </div>
  );
}

