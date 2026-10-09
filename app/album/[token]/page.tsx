import PublicAlbum from "./public-album";
export const dynamic="force-dynamic";
export default async function PublicAlbumPage({params}:{params:Promise<{token:string}>}){const {token}=await params;return <PublicAlbum token={token}/>}
