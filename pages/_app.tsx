import App from 'next/app';
import Head from 'next/head';
import Router, { useRouter } from 'next/router';
import NProgress from 'nprogress';
import Layout from '../components/layout';
import { getHeaderRes, getFooterRes, getAllEntries } from '../helper';
import 'nprogress/nprogress.css';
import '../styles/third-party.css';
import '../styles/style.css';
import '../styles/globals.css'
import 'react-loading-skeleton/dist/skeleton.css';
import '@contentstack/live-preview-utils/dist/main.css';
import { Props } from "../typescript/pages";

import { DndContext } from '@dnd-kit/core';



Router.events.on('routeChangeStart', () => NProgress.start());
Router.events.on('routeChangeComplete', () => NProgress.done());
Router.events.on('routeChangeError', () => NProgress.done());

function MyApp(props: Props) {
  const { Component, pageProps, header, footer, entries } = props;
  const { page, posts, archivePost, blogPost,} = pageProps;

  const router = useRouter();

  // Static and dynamic routes where the layout should be hidden
  const noLayoutRoutes = ['/playground/[contentTypeUid]/[entryUid]', '/contenttype/entry', '/playground/[contentTypeUid]'];
  // const noLayoutDynamicRoutes = [/^\/playground\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/];

  // Check if the route is in the no-layout routes
  const isNoLayoutRoute = () => {
    console.log(router.pathname);
    console.log(noLayoutRoutes.includes(router.pathname));
    return noLayoutRoutes.includes(router.pathname);
  } 

  const metaData = (seo: any) => {
    const metaArr = [];
    for (const key in seo) {
      if (seo.enable_search_indexing) {
        metaArr.push(
          <meta
            name={
              key.includes('meta_')
                ? key.split('meta_')[1].toString()
                : key.toString()
            }
            content={seo[key].toString()}
            key={key}
          />
        );
      }
    }
    return metaArr;
  };
  const blogList: any = posts?.concat(archivePost);
  return (
    <>
      <Head>
        <meta
          name='application-name'
          content='Contentstack-Nextjs-Starter-App'
        />
        <meta charSet='utf-8' />
        <meta httpEquiv='X-UA-Compatible' content='IE=edge' />
        <meta
          name='viewport'
          content='width=device-width,initial-scale=1,minimum-scale=1'
        />
        <meta name='theme-color' content='#317EFB' />
        <title>TechSurf</title>
        {page?.seo && page.seo.enable_search_indexing && metaData(page.seo)}
      </Head>
      {isNoLayoutRoute() ? (
        <Component {...pageProps} />
      ) : (
        // <Layout
        //   header={header}
        //   footer={footer}
        //   page={page}
        //   blogPost={blogPost}
        //   blogList={blogList}
        //   entries={entries}
        // >
          <Component {...pageProps} />
        
      )}
    </>
  );
}

MyApp.getInitialProps = async (appContext: any) => {
  const appProps = await App.getInitialProps(appContext);
  console.log(appProps,"this are my props");
  const header = await getHeaderRes();
  const footer = await getFooterRes();
  const entries = await getAllEntries();

  return { ...appProps, header, footer, entries };
};

export default MyApp;
