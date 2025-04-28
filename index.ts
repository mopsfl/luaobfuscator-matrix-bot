import { MatrixClient, AutojoinRoomsMixin, SimpleFsStorageProvider, MatrixAuth } from "matrix-bot-sdk";
import API from "./modules/LuaObfuscator/API";
import dotenv from "dotenv"

dotenv.config()

const storage = new SimpleFsStorageProvider("luaobfusactor-bot.json")
const client = new MatrixClient(process.env.HOMESERVER, process.env.ACCESS_TOKEN, storage)
const messageAwaits = []

AutojoinRoomsMixin.setupOnClient(client)

function ParseCodeblock(string: string) { return string.replace(/(^`\S*)|`+.*/mg, "").trim() }
function HasCodeblock(string: string) { return /^([`])[`]*\1$|^[`]/mg.test(string) }
async function UploadFile(content: string) { return await client.uploadContent(Buffer.from(content), "text/plain", "obfuscated.lua") }

client.on("room.message", async function (roomId: string, event: any) {
    const body: string = event['content']['body'];

    if (event['content']?.['msgtype'] !== 'm.text') return;
    if (event['sender'] === await client.getUserId()) return;

    if (messageAwaits.find((v => v === roomId))) {
        messageAwaits.splice(messageAwaits.findIndex((v => v === roomId)), 1)

        const script_content = HasCodeblock(body) ? ParseCodeblock(body) : null
        if (!script_content) return await client.replyNotice(roomId, event, "Error: Please provide a valid Lua script as a codeblock or a file.")
        const obfuscatingNoticeEvent = await client.replyNotice(roomId, event, "Obfuscating script...");

        await API.v1.Obfuscate(script_content).then(async result => {
            if (!result.code) {
                return await client.replyNotice(roomId, event, "Error occurred while obfuscating script!");
            }

            const file = await UploadFile(result.code);
            await client.sendMessage(roomId, {
                "msgtype": "m.file",
                "body": "obfuscated.lua",
                "filename": "obfuscated.lua",
                "url": file,
                "info": {
                    mimetype: "text/plain",
                    size: file.length
                }
            });

            await client.sendMessage(roomId, {
                "msgtype": "m.notice",
                "body": "* Obfuscation completed",
                "m.new_content": {
                    "msgtype": "m.notice",
                    "body": "Obfuscation completed"
                },
                "m.relates_to": {
                    "rel_type": "m.replace",
                    "event_id": obfuscatingNoticeEvent
                }
            });
        });
    } else if (body?.startsWith("!obfuscate")) {
        await client.replyNotice(roomId, event, "Please upload a valid Lua script as a file, or paste it here inside a code block.")
        messageAwaits.push(roomId)
    }
})

client.start().then(async () => {
    console.log("Bot started!")
    console.log(await client.getUserId())
});

