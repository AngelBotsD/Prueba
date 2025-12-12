import pkg from '@whiskeysockets/baileys'
const { generateWAMessageContent, generateWAMessageFromContent, proto } = pkg

let handler = async (m, { conn }) => {

  await conn.sendMessage(m.chat, { react: { text: "🔥", key: m.key } })

  async function createImage(url) {
    const { imageMessage } = await generateWAMessageContent(
      { image: { url } },
      { upload: conn.waUploadToServer }
    )
    return imageMessage
  }

  const owners = [
    {
      name: '𝖠𝗇𝗀𝖾𝗅.𝗑𝗒𝗓',
      desc: `𝖢𝗋𝖾𝖺𝖽𝗈𝗋 𝗒 𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈𝗋 𝖯𝗋𝗂𝗇𝖼𝗂𝗉𝖺𝗅 𝖣𝖾 𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍 👑`,
      image: 'https://cdn.russellxz.click/b1af0aef.jpeg',
      buttons: [
        { name: 'WhatsApp', url: 'https://wa.me/5215911153853' }
      ]
    },
    {
      name: '𝖠𝗇𝗀𝖾𝗅.𝖿𝗀𝗓',
      desc: '𝖴𝗇𝗈 𝖣𝖾 𝖫𝗈𝗌 𝖨𝗇𝗏𝖾𝗋𝗌𝗂𝗈𝗇𝗂𝗌𝗍𝖺𝗌 𝖯𝗋𝗂𝗇𝖼𝗂𝗉𝖺𝗅𝖾𝗌 🗣️',
      image: 'https://cdn.russellxz.click/295d5247.jpeg',
      buttons: [
        { name: 'WhatsApp', url: 'https://wa.me/5215584393251' }
      ]
    }
  ]

  let cards = []
  for (let owner of owners) {
    const imageMsg = await createImage(owner.image)

    let formattedButtons = owner.buttons.map(btn => ({
      name: 'cta_url',
      buttonParamsJson: JSON.stringify({
        display_text: btn.name,
        url: btn.url
      })
    }))

    cards.push({
      body: proto.Message.InteractiveMessage.Body.fromObject({
        text: `*${owner.name}*\n${owner.desc}`
      }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({
        text: owner.footer
      }),
      header: proto.Message.InteractiveMessage.Header.fromObject({
        hasMediaAttachment: true,
        imageMessage: imageMsg
      }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
        buttons: formattedButtons
      })
    })
  }

  const slideMessage = generateWAMessageFromContent(
    m.chat,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: proto.Message.InteractiveMessage.fromObject({
            carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
              cards
            })
          })
        }
      }
    },
    {}
  )

  await conn.relayMessage(m.chat, slideMessage.message, { messageId: slideMessage.key.id })
}

handler.command = handler.help = ['donar', 'owner', 'cuentasoficiales', 'creador', 'cuentas']

export default handler