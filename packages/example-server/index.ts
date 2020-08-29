import 'reflect-metadata';
import {ApplicationServer} from '@super-hornet/framework-server';
import {t, entity} from '@super-hornet/marshal';
import {hornet, http} from '@super-hornet/framework-server-common';
import {HttpError} from '@super-hornet/framework-server-common';

class HttpInvalidArgument extends HttpError(400) {
}

@entity.name('HelloBody')
class HelloBody {
    @t name: string = '';
}

@http.controller()
class TestController {
    @http.GET()
    helloWorld() {
        return 'Hello 🌍';
    }

    @http.POST()
    addHello(body: HelloBody) {
        return `Hello ${body.name}`;
    }

    @http.GET('/:name')
        .throws(HttpInvalidArgument, 'when name is invalid')
    getHello(name: string) {
        if (!name) throw new HttpInvalidArgument('name is invalid');

        return `Hello ${name}`;
    }
}

@hornet.module({
    controllers: [TestController],

})
class AppModule {
}

new ApplicationServer(AppModule).start();